# Testing

Two layers, deliberately not one:

## `apps/api/test/*.test.ts` — plain Vitest, pure logic only

No Workers runtime, no D1, no mocking — these test the business-rule
functions extracted into `apps/api/src/lib/` precisely so they *can* be
tested this way: password hashing (`crypto.ts`), the appointment overlap
rule (`scheduling.ts`), invoice status derivation (`billing.ts`), and WhatsApp
number/message formatting (`whatsapp.ts`). Fast (well under a second) and
run on every `npm run test -w apps/api`.

Routes themselves (the D1/R2-touching parts) are covered by the e2e layer
instead of Workers-runtime unit tests — see the note in `apps/api/vitest.config.ts`
for why (the modern Cloudflare Vitest integration, `@cloudflare/vitest-plugin`,
adds real value for testing Durable Objects and bindings directly, which this
app doesn't need; the e2e suite already exercises every route through real
HTTP calls against a real local D1).

## `apps/web/e2e/*.spec.ts` — Playwright, the three critical paths

Explicitly required by the intake doc: **booking, billing, and patient
record access**, each as one focused spec:

- `booking.spec.ts` — creates a patient, books an appointment, and proves
  the clinic can never double-book a slot (a second overlapping booking is
  rejected with a clear error).
- `billing.spec.ts` — creates an invoice with line items and takes it from
  unpaid → partially paid → paid by recording real payments.
- `patient-records.spec.ts` — records patient details and a treatment note,
  confirms the tooth chart reflects it, and proves a previously-viewed
  patient stays readable when the device goes offline mid-session (an SPA
  transition, not a hard reload — see `apps/web/src/offline/` for why that's
  the guarantee this app actually makes).

Each spec creates its own uniquely-named patient (`e2e/helpers.ts`
`uniquePatient()`) so specs never collide, since they share one local D1 for
the whole run (`fullyParallel: false`, one worker).

### How it's wired (`apps/web/playwright.config.ts`)

Playwright's `webServer` array starts **both** apps itself:

1. `apps/api`: wipes local D1 state, applies migrations fresh, then
   `wrangler dev` — every run starts from an identical, empty database.
2. `apps/web`: builds in a dedicated `test` mode (`.env.test` points
   `VITE_API_URL` at the local Worker) and serves the build with `vite preview`
   — real production output, not `vite dev`.

`global-setup.ts` then bootstraps the one doctor account
(`POST /api/auth/bootstrap`) before any spec runs.

**The PWA service worker is intentionally left out of the `test` build**
(`vite.config.ts` skips the `VitePWA` plugin when `mode === "test"`). It isn't
part of what these specs check, and a service worker mid install/activate
adds cross-run timing that has nothing to do with the business logic being
tested — a debugging session while building this app found it was the actual
cause of flaky, unrelated-looking full-page-navigation failures. It's
exercised implicitly by every real Cloudflare Pages preview build instead.

### Running

```bash
npm run test:e2e -w apps/web
```

In the Claude Code cloud sandbox: `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e -w apps/web`,
and never run `npx playwright install`. CI (`.github/workflows/ci.yml`) runs
a real `playwright install --with-deps chromium` instead, since GitHub-hosted
runners don't have Playwright's browsers preinstalled.

## What isn't covered, and why that's an accepted gap for v1

- File upload/download — needs a real multipart request against a real R2
  bucket; the three e2e specs above don't touch it, but it was exercised
  by hand end-to-end while building this app (see the session's report).
  Worth a fourth spec if files become a heavier part of daily use.
- Reminders — the WhatsApp link-generation logic is simple enough that manual
  verification (also done while building this app: correct phone formatting,
  correct IST date/time in the message) covered it; add a spec if this logic
  grows more rules.
