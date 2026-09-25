# Backup and restore

Two independent layers — use whichever fits the situation.

## Layer 1: Cloudflare D1 Time Travel (built in, automatic)

D1 keeps a point-in-time recovery log automatically; nothing to configure.
To restore to a specific moment (e.g. "5 minutes before that bad migration"):

```bash
npx wrangler d1 time-travel restore clinic_db --remote --timestamp="2026-10-01T09:00:00Z"
```

Or restore to just before a specific bookmark: run
`npx wrangler d1 time-travel info clinic_db --remote` to list recent
bookmarks, then `... time-travel restore clinic_db --remote --bookmark=<id>`.
**Check the retention window in the Cloudflare dashboard (D1 → clinic_db →
Settings) before relying on an old restore point** — Cloudflare's own docs are
the source of truth for exactly how far back this reaches, and that has
changed over time.

This only covers the database (patients, appointments, invoices, ...), not
files in R2.

## Layer 2: nightly export to R2 (this app's own, for defence in depth)

`apps/api/src/lib/backup.ts`, run by the Cron Trigger in `wrangler.toml`
(`0 21 * * *` UTC = 2:30am IST) and also callable on demand by a doctor:

```bash
curl -b <session-cookie> -X POST https://api.drsrisushmadentalclinic.com/api/internal/backup
```

Each run writes one JSON file per day to `backups/YYYY-MM-DD.json` in the
**same R2 bucket used for patient files** (`clinic-files` / `clinic-files-staging`),
containing every row of every table (including `staff`, so a full restore can
sign back in). Files older than 35 days are deleted automatically by the same
job. Restoring from one of these is a manual, deliberate action — there is no
"restore" API endpoint on purpose, since scripting a destructive
overwrite-everything action is exactly the kind of thing that should require
a human reading the file first:

1. `npx wrangler r2 object get clinic-files/backups/2026-10-01.json --remote --file ./restore.json`
2. Read `restore.json` and decide what actually needs restoring — usually
   it's one table or a handful of rows, not everything.
3. Write the specific `INSERT`/`UPDATE` statements by hand (or a short
   throwaway script) against `npx wrangler d1 execute clinic_db --remote`,
   using the backup file as the source of truth for values.
4. Prefer Layer 1 (Time Travel) for "restore everything to before X" — it's
   exact and doesn't need this manual reconstruction. Reach for this export
   when you need one table or a few rows back, or when you want a copy of the
   data outside D1 entirely.

## What's covered vs not

| Data | Time Travel | Nightly R2 export |
|---|---|---|
| D1 tables (patients, appointments, billing, ...) | ✅ | ✅ |
| Patient files/X-rays in R2 | ❌ | ❌ (not re-exported; R2 itself is durable storage, not versioned by this job) |
| Staff password hashes (for a full restore to work) | ✅ | ✅ |

R2 object storage is itself durably replicated by Cloudflare — the backup
job's job is D1 (which has no file storage of its own), not R2 files.

## Before a risky change

Trigger a manual backup first (`POST /api/internal/backup` as a doctor), so
there's a fresh, deliberate restore point independent of the nightly
schedule and Time Travel's rolling window.
