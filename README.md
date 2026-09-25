# Clinic Manager — Dr.Sri Sushma Multispeciality Dental Clinic

An internal scheduling, EMR/dental charting, billing and WhatsApp-reminder app
for the clinic's own staff (not a public website). It's a PWA — installable
on a phone or desktop, works with patchy internet, and runs on Cloudflare's
free tier at this clinic's scale.

See `docs/architecture.md` for how it's built, `docs/setup-checklist.md` for
first-time setup (Cloudflare resources, first login), `docs/testing.md` for
how the test suite works, `docs/backup-and-restore.md` and
`docs/monitoring.md` for the reliability side.

## Stack

- **apps/api** — Cloudflare Worker (Hono), Cloudflare D1 (Drizzle ORM), R2 for files.
- **apps/web** — React + TypeScript + Tailwind PWA (Vite), offline-first via
  a persisted query cache + an outbox for queued writes.
- **packages/shared** — Zod schemas and TypeScript types shared by both.

## Local development

```bash
npm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # no secrets needed yet
npm run db:migrate:local -w apps/api               # first time, and after schema changes
npm run dev:api                                    # terminal 1 — http://localhost:8787
npm run dev:web                                    # terminal 2 — http://localhost:5173
```

Open http://localhost:5173 — the first run redirects to a one-time setup
page that creates the doctor account (works only while no staff exist yet).

## Checks (run these before considering a change done)

| Step | Command |
|---|---|
| Install | `npm install` |
| Typecheck | `npm run typecheck -w packages/shared && npm run typecheck -w apps/api && npm run typecheck -w apps/web` |
| Lint | `npm run lint -w apps/api && npm run lint -w apps/web` |
| Build | `npm run build -w packages/shared && npm run build -w apps/api && npm run build -w apps/web` |
| API unit tests | `npm run test -w apps/api` |
| E2E tests | `npm run test:e2e -w apps/web` (builds+runs both apps against a fresh local D1 automatically) |

In the Claude Code cloud sandbox, prefix Playwright commands with
`CHROMIUM_PATH=/opt/pw-browsers/chromium` and never run `npx playwright install`.
On other machines, run `npx playwright install chromium` once first.

## Deploying

- **Frontend (apps/web)**: deployed by Cloudflare Pages' own GitHub integration
  (build command `npm run build -w apps/web`, output `apps/web/dist`, root
  directory the repo root). No GitHub Actions step needed for it.
- **API Worker (apps/api)**: `.github/workflows/deploy-api.yml` runs
  `wrangler deploy` on push to `staging` or `main`, needs the
  `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets and the real
  D1/R2 resource IDs in `apps/api/wrangler.toml` — see `docs/setup-checklist.md`.

## Repo map

| Path | What it is |
|---|---|
| `apps/api/src/routes/` | One file per module: auth, staff, patients, appointments, treatments, invoices, files, reminders, health, internal (manual backup trigger) |
| `apps/api/src/db/schema.ts` | Drizzle schema — the source of truth for the D1 tables |
| `apps/api/migrations/` | Generated SQL migrations (`npm run db:generate -w apps/api` after a schema change) |
| `apps/api/src/lib/` | Pure business logic (crypto, scheduling conflict rule, billing status, WhatsApp link building) — unit tested in `apps/api/test/` |
| `apps/web/src/pages/` | One folder per module, mirroring the API |
| `apps/web/src/offline/` | The offline engine: persisted query cache (`persister.ts`) + write outbox (`outbox.ts`) + sync status (`SyncContext.tsx`) |
| `apps/web/e2e/` | Playwright specs for the three critical paths: booking, billing, patient records |
| `packages/shared/src/schemas/` | Zod schemas + types used by both apps, so a request shape can't drift between frontend and backend |
| `docs/` | Setup checklist, architecture notes, backup/restore and monitoring runbooks |
