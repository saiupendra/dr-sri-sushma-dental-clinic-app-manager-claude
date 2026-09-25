# Setup checklist

Everything code-side is done and tested (see the main report). What's left
needs either the owner's Cloudflare account access or an explicit go-ahead to
provision real cloud resources — this session built the app but didn't touch
the live Cloudflare account beyond what's already public. Do these in order;
each one's "verify" line is how to confirm it worked before moving on.

## 1. Cloudflare resources (Workers/D1/R2)

This account already runs the marketing site, so it's the same account, just
new resources in it (`account_id` `416c78ac43f50ba1acc9a2e80e82b45a`, per the
sister repo).

1. Create two D1 databases:
   ```bash
   npx wrangler d1 create clinic_db
   npx wrangler d1 create clinic_db_staging
   ```
   Each prints a `database_id` — put it into `apps/api/wrangler.toml`,
   replacing `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID` /
   `REPLACE_WITH_STAGING_D1_DATABASE_ID`.
2. Create two R2 buckets:
   ```bash
   npx wrangler r2 bucket create clinic-files
   npx wrangler r2 bucket create clinic-files-staging
   ```
3. Apply migrations to both:
   ```bash
   npm run db:migrate:production -w apps/api
   npm run db:migrate:staging -w apps/api
   ```
   **Verify**: `npx wrangler d1 execute clinic_db --remote --command "select name from sqlite_master where type='table'"`
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

## 4. Cloudflare Pages project (frontend)

Cloudflare dashboard → Workers & Pages → Create → Pages → connect this
GitHub repo (`saiupendra/dr-sri-sushma-dental-clinic-app-manager-claude`).

- **Production branch**: `main`.
- **Build command**: `npm run build -w apps/web`
- **Build output directory**: `apps/web/dist`
- **Root directory**: `/` (repo root — needed so the npm workspace install
  resolves `@clinic/shared` correctly; do not set it to `apps/web`).
- **Environment variables** (Settings → Environment variables), one value
  per environment:
  - Production: `VITE_API_URL` = `https://api.drsrisushmadentalclinic.com`
  - Preview (used for the `staging` branch): `VITE_API_URL` = `https://api-staging.drsrisushmadentalclinic.com`
- After the first deploy, add custom domains: `app.drsrisushmadentalclinic.com`
  to production, `staging-app.drsrisushmadentalclinic.com` to the `staging`
  branch preview.

**Verify**: open `https://app.drsrisushmadentalclinic.com` — you should land
on the one-time setup page (see step 5).

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
