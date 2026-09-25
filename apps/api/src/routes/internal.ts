import { Hono } from "hono";
import { runNightlyBackup } from "../lib/backup.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import type { AppContext } from "../types.js";

export const internalRoutes = new Hono<AppContext>();
internalRoutes.use("*", requireAuth, requireRole("doctor"));

/** Lets a doctor trigger an out-of-band backup before a risky change, without waiting for the nightly cron. */
internalRoutes.post("/backup", async (c) => {
  const result = await runNightlyBackup(c.env);
  return c.json({ ok: true, ...result });
});
