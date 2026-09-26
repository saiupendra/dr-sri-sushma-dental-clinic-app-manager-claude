import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./routes/auth.js";
import { staffRoutes } from "./routes/staff.js";
import { patientRoutes } from "./routes/patients.js";
import { appointmentRoutes } from "./routes/appointments.js";
import { treatmentRoutes } from "./routes/treatments.js";
import { invoiceRoutes } from "./routes/invoices.js";
import { publicInvoiceRoutes } from "./routes/publicInvoices.js";
import { fileRoutes } from "./routes/files.js";
import { reminderRoutes } from "./routes/reminders.js";
import { healthRoutes } from "./routes/health.js";
import { internalRoutes } from "./routes/internal.js";
import { adminRoutes } from "./routes/admin.js";
import { runNightlyBackup } from "./lib/backup.js";
import type { AppContext, Env } from "./types.js";

const app = new Hono<AppContext>();

// ALLOWED_ORIGIN is per-environment (see wrangler.toml), so CORS is configured
// per-request from c.env rather than once at module load.
app.use("*", async (c, next) => {
  const allowed = c.env.ALLOWED_ORIGIN.split(",").map((origin) => origin.trim());
  return cors({ origin: allowed, credentials: true })(c, next);
});

app.route("/health", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/staff", staffRoutes);
app.route("/api/patients", patientRoutes);
app.route("/api/appointments", appointmentRoutes);
app.route("/api/treatments", treatmentRoutes);
app.route("/api/invoices", invoiceRoutes);
app.route("/api/public/invoices", publicInvoiceRoutes);
app.route("/api/files", fileRoutes);
app.route("/api/reminders", reminderRoutes);
app.route("/api/internal", internalRoutes);
app.route("/api/admin", adminRoutes);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default {
  fetch: app.fetch,

  // Cloudflare Cron Trigger entry point (see [[env.*.triggers.crons]] in wrangler.toml).
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runNightlyBackup(env)
        .then((result) => console.log(`Nightly backup complete: ${result.key} (${result.sizeBytes} bytes)`))
        .catch((err) => console.error("Nightly backup failed", err)),
    );
  },
};
