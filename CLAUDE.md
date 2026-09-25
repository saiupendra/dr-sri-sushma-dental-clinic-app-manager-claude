# CLAUDE.md — Clinic Manager

Internal clinic-management PWA for Dr.Sri Sushma Multispeciality Dental
Clinic: scheduling, EMR/dental charting, billing, WhatsApp reminders. Staff
tool, not the public marketing site (that's a separate repo,
`dr-sushma-dental-clinic-cloudflare` — different rules, different domain,
don't conflate the two). Read `docs/architecture.md` before making a
structural change; it explains *why* things are built this way, not just
what's there.

## Non-negotiables

1. **This is health data.** Never log, print, or put in a commit message a
   patient's name, phone, medical history, or any other identifying detail.
   Test data uses obviously-fake names (see `apps/web/e2e/helpers.ts`
   `uniquePatient()`).
2. **RBAC is load-bearing, not decorative.** Treatment records (clinical
   notes) are doctor-only to write — never loosen this without the owner
   confirming a second treating dentist exists. See `docs/architecture.md`'s
   RBAC table before adding a new route.
3. **Every mutating route validates with a shared Zod schema** from
   `packages/shared`, applied via `validate()` (`apps/api/src/lib/validate.ts`).
   Don't hand-roll validation in a route.
4. **A new optional text field bound to an HTML input must use
   `optionalString()`** (`packages/shared/src/schemas/common.ts`), not bare
   `.optional()`, if it has a format constraint (email, enum, regex, uuid).
   Plain HTML inputs submit `""` when empty, not `undefined`, and
   `z.string().email().optional()` rejects `""` as an invalid email. This
   exact bug shipped once already and was only caught by the e2e suite — see
   the git history around when `optionalString` was introduced if you want
   the full story.
5. **New offline-critical writes** (if you extend the pattern beyond
   patients/appointments/treatments) go through `useOfflineMutation`
   (`apps/web/src/offline/useOfflineMutation.ts`), not a raw `useMutation`.
   Everything else can use a plain `useMutation` that fails loudly offline —
   that's an intentional, documented scope choice (`docs/architecture.md`
   "Known limitations"), not an oversight to "fix" by wiring more things
   through the outbox without thinking about whether queuing them actually
   makes sense (billing math, staff-account changes, and anything needing
   live connectivity anyway do not belong in the outbox).
6. **Never persist auth state to the offline cache.** `main.tsx`'s
   `shouldDehydrateQuery` excludes `["auth", ...]` queries on purpose — a
   stale cached "signed out" snapshot rehydrated on a fresh page load
   bounces an already-signed-in user through `/login` and (before a second
   fix) used to drop their intended destination's query string. Don't
   re-enable persisting it without re-reading that comment.
7. **Do only what was asked.** Note other problems under Risk/Review in your
   report rather than fixing them in the same change, unless they block the
   actual task.
8. **Never commit to `main` directly, and never push to `main`/`staging` or
   merge a PR without the user's explicit go-ahead** for that exact change —
   `staging` and `main` both trigger a real deploy (see `.github/workflows/`).

## Commands

| Step | Command |
|---|---|
| Install | `npm install` (root — this is an npm-workspaces monorepo) |
| Typecheck | `npm run typecheck -w packages/shared && npm run typecheck -w apps/api && npm run typecheck -w apps/web` |
| Lint | `npm run lint -w apps/api && npm run lint -w apps/web` (ESLint flat config at the repo root, `eslint.config.js`, covers both) |
| Build | `npm run build -w packages/shared && npm run build -w apps/api && npm run build -w apps/web` |
| API unit tests | `npm run test -w apps/api` (plain Vitest, no Workers runtime — see `docs/testing.md`) |
| E2E tests | `npm run test:e2e -w apps/web` (Playwright; starts both apps itself against a fresh local D1) |

Rebuild `packages/shared` after touching any file under `packages/shared/src`
— both apps consume its compiled `dist/`, not its source, so a stale build
silently hides your change (TS project references aren't wired up here).

In the Claude Code cloud sandbox: prefix Playwright commands with
`CHROMIUM_PATH=/opt/pw-browsers/chromium`; never run `npx playwright install`.

After any schema change in `apps/api/src/db/schema.ts`:
```bash
npm run db:generate -w apps/api      # writes a new file in apps/api/migrations/
npm run db:migrate:local -w apps/api # applies it to your local dev D1
```
Never hand-edit a migration file already committed; add a new one.

## Repo map

See `README.md`'s table — it's kept there, not duplicated here, so there's
one place to update.

## Recipes

**Add a new field to an existing entity.** Edit the Drizzle schema
(`apps/api/src/db/schema.ts`), generate + apply a migration, add the field to
the relevant Zod schema(s) in `packages/shared` (create/update/response as
applicable — `optionalString()` if it's optional and format-constrained),
rebuild `packages/shared`, update the route's `to<Entity>()` mapper function
to include it, then the frontend hook/form. Run the full check list before
calling it done.

**Add a new module/entity entirely.** Follow the existing pattern for one
close to it (e.g. copy `treatments.ts`'s route file structure for a new
clinical thing, or `invoices.ts` for a new billing-shaped thing): schema →
shared Zod schemas → route file (mounted in `apps/api/src/index.ts`) → RBAC
decision (who can read/write it — default to "both roles" unless there's a
clinical or admin reason to restrict, per the RBAC table in
`docs/architecture.md`) → frontend hook → frontend page(s) → route in
`apps/web/src/App.tsx` → nav entry in `apps/web/src/components/Layout.tsx` if
it's a top-level section.

**Change a clinic-facing conversion/reminder detail** (message wording, the
WhatsApp number heuristic): `apps/api/src/lib/whatsapp.ts`. It has unit tests
(`apps/api/test/whatsapp.test.ts`) — update them alongside a behavior change,
don't just delete an inconvenient assertion.

## Known gotchas (so you don't re-debug them)

- **`vite preview` (production build) vs `vite dev`**: the PWA service
  worker only exists in the real build. If you're chasing a bug that only
  reproduces "after a full page reload" in the built app, check whether it's
  actually the service worker's precache/navigateFallback interacting badly
  with your change before assuming it's application logic — this has
  happened once already (see `docs/testing.md`).
- **Hono sub-routes never get a trailing slash.** `app.route("/api/x", sub)`
  with `sub.get("/")` matches exactly `/api/x`, not `/api/x/`. Confirmed by
  direct testing while building this app, not assumed from memory — see
  `docs/testing.md` if you need to re-verify after a Hono upgrade.
- **CORS in local dev**: `apps/api/wrangler.toml`'s default (no `--env`)
  `ALLOWED_ORIGIN` lists both `:5173` (`vite dev`) and `:4173` (`vite preview`,
  what the e2e suite uses). If you add a third local port/tool, add it there
  too or its requests will be silently blocked by the browser, not the server
  (no helpful server-side error to find).

## Skills

Nothing project-specific is required beyond what's already listed as
available. For a multi-step feature, write a short plan first (even just a
todo list) rather than diving straight into code — this app has enough
moving parts (D1 schema, shared types, two frontends' worth of routes/pages,
offline behavior, RBAC) that skipping that step costs more time than it
saves.

## Report format

Same spirit as any change to this codebase: say what changed, which checks
you ran and their results, what's unverified or needs the owner's decision,
and whether it's actually done (all checks green) or needs follow-up.
