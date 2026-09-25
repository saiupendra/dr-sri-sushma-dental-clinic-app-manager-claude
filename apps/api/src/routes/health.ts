import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import type { AppContext } from "../types.js";

export const healthRoutes = new Hono<AppContext>();

/**
 * Unauthenticated liveness/readiness check. Point an external monitor (e.g.
 * a free UptimeRobot check) at this URL — see docs/monitoring.md.
 */
healthRoutes.get("/", async (c) => {
  const startedAt = Date.now();
  try {
    const db = getDb(c.env);
    await db.run(sql`select 1`);
    return c.json({
      status: "ok",
      environment: c.env.ENVIRONMENT,
      dbLatencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Health check failed", err);
    return c.json({ status: "error", time: new Date().toISOString() }, 503);
  }
});
