# Architecture

## High level

```
┌─────────────────────┐        HTTPS, credentials: 'include'        ┌──────────────────────────┐
│  apps/web (PWA)      │ ───────────────────────────────────────────▶ │ apps/api (Cloudflare      │
│  React + Vite        │ ◀─────────────────────────────────────────── │ Worker, Hono)             │
│  Cloudflare Pages     │        cookie session, JSON                 │                           │
└─────────────────────┘                                              │  ├─ D1 (Drizzle ORM)       │
        │  ▲                                                          │  ├─ R2 (files + backups)   │
        │  │ persisted cache + outbox                                 │  └─ Cron Trigger (nightly  │
        ▼  │ (IndexedDB)                                               │     backup export)         │
   offline reads / queued writes                                      └──────────────────────────┘
```

Two separately deployed pieces, on purpose: the frontend is static (Cloudflare
Pages, its own git-integration deploy) and the API is a Worker (deployed by
`.github/workflows/deploy-api.yml`). This mirrors the sister marketing site's
pattern and means a frontend-only change never needs a Worker deploy.

## Modules

Each is one route file in `apps/api/src/routes/` and one folder in
`apps/web/src/pages/` (see the LLD's "Core Modules" list this app was
scoped from):

1. **Patients** — demographics, contact, medical history notes.
2. **Scheduling** — appointments with a real conflict check (`hasConflict` in
   `appointments.ts`, backed by the unit-tested pure function `rangesOverlap`
   in `lib/scheduling.ts`).
3. **EMR / dental charting** — `treatment_records` rows, one per procedure,
   optionally tied to an FDI tooth number and a condition. The tooth chart
   itself (`GET /api/patients/:id/tooth-chart`) has no table of its own — it's
   derived from the latest treatment record per tooth (`lib/toothChart.ts`),
   so there is exactly one source of truth for a tooth's condition.
4. **Billing** — invoices with line items and payments. `status` is always
   derived from `amountPaid` vs `totalAmount` (`lib/billing.ts`), never set by
   hand, except `cancelled` which is explicit and sticky.
5. **Reminders** — the one-tap WhatsApp flow: `POST /api/reminders` logs a
   reminder and returns a `wa.me` deep link with a pre-filled message; nothing
   sends automatically. See "Reminders" below for why.
6. **Files** — X-rays/documents uploaded straight from the browser into R2
   through the Worker (`files.ts`), no presigned URLs or S3 credentials.
7. **Staff** — doctor-only account management; front-desk accounts can be
   deactivated (ends their sessions immediately) and password-reset.

Plus the cross-cutting **auth/RBAC** layer (session cookies, `requireAuth` /
`requireRole` middleware) and **reliability plumbing** (`/health`, the global
error handler, the nightly backup export).

## Data model

See `apps/api/src/db/schema.ts` for the authoritative version. In short:
`staff`, `sessions`, `patients`, `appointments`, `treatment_records`,
`invoices` + `invoice_items` + `payments`, `files`, `reminders`. All primary
keys are client-generated UUIDs (see "Offline writes" below for why), and
every mutable table has `created_at`/`updated_at`; the ones users can delete
have a soft-delete `deleted_at` instead of a real `DELETE`.

## RBAC

Two roles: `doctor` (full access) and `front_desk`. The split, enforced with
`requireRole("doctor")` at specific routes:

| Module | front_desk | doctor |
|---|---|---|
| Patients, appointments, invoices/payments, files, reminders | read/write | read/write |
| Treatment records (clinical notes) | read only | read/write |
| Staff accounts | no access | read/write |

Clinical write access is doctor-only because Dr.Sri Sushma leads all
treatment at this clinic (per the intake doc) — front-desk should never be
the author of a clinical note. If a second treating dentist joins later,
this is the one place that needs revisiting.

## Auth

Sessions are opaque random tokens (`lib/crypto.ts` `randomToken`), stored in
D1 as their SHA-256 hash (`sessions` table) — a database leak can't be turned
into valid session tokens. The cookie is `httpOnly`, `Secure`, `SameSite=Lax`,
scoped to `COOKIE_DOMAIN` in production so it's shared between
`app.` and `api.` subdomains. Passwords are hashed with PBKDF2-SHA256 (Web
Crypto, no native dependency — works as-is in the Workers runtime).

The very first account is created by `POST /api/auth/bootstrap`, which only
works while the `staff` table is empty — there is no other way to create a
doctor account, by design, and no way to re-run it once one exists.

## Offline design

Two independent halves, deliberately not one system, because they solve
different problems:

- **Reads**: `@tanstack/react-query-persist-client` persists the *entire*
  React Query cache to IndexedDB (`apps/web/src/offline/persister.ts`) and
  rehydrates it on load. Every successful `GET` a screen has ever rendered is
  therefore available again offline, for every entity, with no per-entity
  caching code. Auth state (`["auth", ...]` queries) is the one deliberate
  exception — see the comment in `main.tsx` for why persisting a stale
  "signed out" snapshot is actively harmful.
- **Writes**: `apps/web/src/offline/outbox.ts` is a small queue (one
  IndexedDB array). `useOfflineMutation` (`offline/useOfflineMutation.ts`)
  tries the real request first; only a genuine connectivity failure
  (`NetworkError`, not a 4xx/5xx) gets queued. `SyncContext` flushes the
  queue on reconnect and every 30s while online. Replay is last-write-wins
  and in original order; a queued item the server actively rejects on replay
  (not a network failure) is dropped and logged rather than blocking the
  queue forever.
- Applied to **patients, appointments and treatment notes** — the flows
  explicitly named in the intake doc ("staff should be able to access patient
  records and make notes offline"). Billing, files, reminders and staff
  management fail loudly instead of queuing (see "Known limitations").
- Writes use **client-generated UUIDs** and idempotent inserts
  (`onConflictDoNothing`) specifically so a queued create replayed twice
  (e.g. after a dropped response) can't produce a duplicate row.

## Known limitations (v1, by design — not oversights)

- **File uploads need a live connection.** Binary bytes aren't queued in the
  outbox. A queued upload UI (chunked, resumable) is a reasonable v2 if this
  becomes a real problem at the clinic.
- **Billing, reminders and staff actions fail loudly when offline** rather
  than queuing. Invoice totals/status are server-computed, a WhatsApp
  reminder needs live connectivity anyway, and staff-account actions are
  infrequent, admin, and safer not queued out of order.
- **No native app wrapper.** The PWA is installable (Add to Home Screen /
  desktop install) on Android, desktop Chrome/Edge and iOS Safari; a Capacitor
  or similar native wrapper is future work if ever needed (see the intake
  doc's Open Decisions).
- **No cross-device conflict resolution beyond last-write-wins.** Fine for a
  small clinic's typical usage (one or two staff, rarely editing the exact
  same record at the exact same moment); revisit if that stops being true.
- **D1 free tier**: 5 million row reads/day, 100,000 row writes/day, 5GB
  storage (Cloudflare's published limits, enforced since 2026-09-01). Utterly
  out of reach at one small clinic's scale — flagged here only so a future
  session doesn't have to re-derive it.
