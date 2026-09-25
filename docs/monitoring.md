# Monitoring

## Uptime / reachability

`GET /health` (no auth) checks the API is up and can reach D1:

```json
{"status":"ok","environment":"production","dbLatencyMs":12,"time":"..."}
```

Point a free external monitor at it — UptimeRobot's free plan (50 monitors,
5-minute checks) is plenty at this scale:

1. https://uptimerobot.com → Add New Monitor → HTTP(s).
2. URL: `https://api.drsrisushmadentalclinic.com/health`.
3. Interval: 5 minutes. Alert contact: the owner's email/phone.
4. Optional second monitor on the staging URL, alerting nowhere critical
   (staging going down isn't an emergency) or just left unmonitored.

A `503` response (health check itself catches and reports D1 failures) or a
timeout is the "wake someone up" signal — the two things this app cannot
recover from on its own are the Worker being unreachable and D1 being
unreachable, and this endpoint catches both.

## Errors

- **Cloudflare dashboard** → Workers & Pages → the Worker → Logs, or
  `npx wrangler tail dr-sri-sushma-clinic-api-production` for a live stream.
  Every unhandled error is logged with `console.error` by the global error
  handler (`apps/api/src/middleware/errorHandler.ts`) before it turns into a
  clean JSON response for the client — nothing fails silently.
- The nightly backup job logs its own outcome (`console.log`/`console.error`
  in `lib/backup.ts`) — a missing "Nightly backup complete" line in the logs
  around 2:30am IST is worth investigating.

## What "healthy" looks like day to day

- `/health` green.
- No `internal_error` entries in the Worker logs over a normal day (a
  `validation_error`, `not_found`, `unauthorized` or `conflict` is normal —
  those are expected client mistakes or business rules, not bugs).
- A `backups/YYYY-MM-DD.json` object appears in R2 every morning.

## If something's down

1. Check `/health` — is it the Worker, or just D1?
2. Check `npx wrangler tail` for the actual error.
3. Check the Cloudflare status page (https://www.cloudflarestatus.com/) —
   rule out a platform-wide incident before debugging your own code.
4. A bad deploy: `npx wrangler deployments list --name dr-sri-sushma-clinic-api-production`
   then `npx wrangler rollback --name dr-sri-sushma-clinic-api-production` to
   the last good version while you fix the real issue. Cloudflare Pages has
   the equivalent "Rollback to this deployment" button in its dashboard for
   the frontend.
