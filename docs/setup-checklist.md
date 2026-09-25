# Setup checklist

Status: steps 1 and 4 are done (2026-09-25, via the Cloudflare API — see
below). What's left needs either the owner's manual action (a GitHub token
value can't be generated on your behalf) or a decision on DNS, since that
touches the same zone the marketing site uses. Each "verify" line confirms a
step worked before moving to the next.

## 1. Cloudflare resources (Workers/D1/R2) — ✅ done

Same account as the marketing site (`account_id`
`416c78ac43f50ba1acc9a2e80e82b45a`). Created via the Cloudflare API (not
`wrangler`, since this session's sandbox can't reach `api.cloudflare.com`
directly):

| Resource | id / name |
|---|---|
| D1 `clinic_db` (production) | `886abbed-30d6-41c7-8d02-da429900cebb` |
| D1 `clinic_db_staging` | `6e048be3-ee42-4275-85ae-4295e273d42d` |
| R2 `clinic-files` (production) | created |
| R2 `clinic-files-staging` | created |

Both IDs are already filled into `apps/api/wrangler.toml` — `wrangler deploy
--dry-run` bundles cleanly against both. **Not yet done**: migrations haven't
been applied to either remote database — that happens the first time
`.github/workflows/deploy-api.yml` runs (step 3 needs its secrets first), or
run `npm run db:migrate:production -w apps/api` /
`npm run db:migrate:staging -w apps/api` yourself once you have a Cloudflare
API token locally.

**Verify** (after migrations run): `npx wrangler d1 execute clinic_db --remote --command "select name from sqlite_master where type='table'"`
lists all 10 tables (staff, sessions, patients, appointments, ...).

## 2. DNS + custom domains

Add two subdomains on the `drsrisushmadentalclinic.com` zone (Cloudflare
dashboard → DNS), then attach them as Worker custom domains:

| Hostname | Points to |
|---|---|
| `api.drsrisushmadentalclinic.com` | Worker custom domain → `dr-sri-sushma-clinic-api-production` |
| `api-staging.drsrisushmadentalclinic.com` | Worker custom domain → `dr-sri-sushma-clinic-api-staging` |
| `app.drsrisushmadentalclinic.com` | Cloudflare Pages custom domain (step 4) |
| `staging-app.drsrisushmadentalclinic.com` | Cloudflare Pages custom domain, preview branch (step 4) |

A Worker custom domain (Cloudflare dashboard → Workers & Pages → your Worker
→ Settings → Domains & Routes) auto-creates the DNS record and issues the
certificate; you don't need to add the DNS row by hand first.

**This touches the same zone the marketing site uses** — per that repo's own
rules, Cloudflare changes need the owner's explicit approval of the exact
change. Read `apps/web/.env.example` / `apps/api/wrangler.toml` for the exact
hostnames before creating anything.

## 3. GitHub Actions secrets (for `.github/workflows/deploy-api.yml`)

Repo → Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN` — a token scoped to Workers Scripts (Edit), D1
  (Edit), and Account Settings (Read) for this account. Create at
  https://dash.cloudflare.com/profile/api-tokens.
- `CLOUDFLARE_ACCOUNT_ID` — `416c78ac43f50ba1acc9a2e80e82b45a`.

**Verify**: push a commit to `staging` and check the "Deploy API Worker" run
in the Actions tab goes green, then `curl https://api-staging.drsrisushmadentalclinic.com/health`.

## 4. Cloudflare Pages project (frontend) — ✅ done

Created via the Cloudflare API, connected to this GitHub repo (the account's
existing GitHub App authorization already covered it — no manual OAuth step
needed):

- Project name: **`clinic-manager`**, currently at `clinic-manager-eh7.pages.dev`.
- Production branch `main`; build command `npm run build -w apps/web`;
  output `apps/web/dist`; root directory `/`.
- `VITE_API_URL` environment variable already set: production →
  `https://api.drsrisushmadentalclinic.com`, preview (used by the `staging`
  branch) → `https://api-staging.drsrisushmadentalclinic.com`.

**Not yet done**: `main` has no commits yet (this app's work is on
`claude/clinic-management-app`, per this session's branch instructions), so
there's been no build yet, and the custom domains
(`app.drsrisushmadentalclinic.com`, `staging-app.drsrisushmadentalclinic.com`)
aren't attached — that's the DNS step (step 2), which needs your go-ahead
since it's the same zone as the marketing site.

**Verify**: once `main` has a commit and step 2's domain is attached, open
`https://app.drsrisushmadentalclinic.com` — you should land on the one-time
setup page (see step 5). Until then, `https://clinic-manager-eh7.pages.dev`
will show it (once `main` has something to build).

## 5. First login

Open the deployed app (staging first, then production) — with no staff yet,
it redirects to a one-time setup page that creates the first **doctor**
account. This only works once; after that, that doctor signs in and creates
front-desk accounts from Staff → Add staff.

**Verify**: sign in, and confirm `Staff` in the nav only appears for that
doctor account, not for a front-desk account you create afterwards.

## 6. Monitoring (see `docs/monitoring.md` for detail)

- Point a free uptime monitor (e.g. UptimeRobot) at
  `https://api.drsrisushmadentalclinic.com/health`, checking every 5 minutes,
  alerting by email/SMS to the owner.
- Optional: wire Cloudflare's own Workers observability/logs (`wrangler tail`
  or the dashboard) for error visibility beyond what the uptime check gives you.

## 7. Backups (see `docs/backup-and-restore.md` for detail)

Nothing to set up — the nightly export runs automatically once the Worker is
deployed with its Cron Trigger (already declared in `wrangler.toml`). Confirm
it ran: `npx wrangler r2 object get clinic-files --remote --pipe /dev/null` isn't
useful for listing; instead check via the dashboard (R2 → clinic-files →
`backups/` prefix) that a dated JSON file appears the morning after the first
deploy, or trigger one immediately as a doctor: `POST /api/internal/backup`.

## 8. WhatsApp reminders — current state and future upgrade

v1 ships the **one-tap** flow the owner chose: staff click "Send reminder" on
an appointment, the app opens WhatsApp Web/app with a pre-filled message to
the patient's number, and staff hit send themselves inside WhatsApp. No Meta
Business account or API costs. Nothing to set up for this to work.

If the clinic later wants fully automatic sending (no staff tap required),
that needs a Meta WhatsApp Business Cloud API account, phone number
verification and approved message templates — a separate piece of work, not
part of this setup checklist.

## Not needed for this app

Per the owner's choice of Cloudflare D1 (not Supabase), skip any Supabase
setup. Per the one-tap WhatsApp choice, skip Twilio/Gupshup/Meta Business
setup for now (see step 8 for the future path).
