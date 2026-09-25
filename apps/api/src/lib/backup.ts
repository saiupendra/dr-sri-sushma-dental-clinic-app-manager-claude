import { getDb } from "../db/client.js";
import {
  appointments,
  files,
  invoiceItems,
  invoices,
  patients,
  payments,
  reminders,
  staff,
  treatmentRecords,
} from "../db/schema.js";
import type { Env } from "../types.js";

const RETENTION_DAYS = 35;
const BACKUP_KEY_PATTERN = /^backups\/(\d{4}-\d{2}-\d{2})\.json$/;

/**
 * Nightly export of every table to R2, on top of D1's own point-in-time
 * recovery (Time Travel) — see docs/backup-and-restore.md for how to use
 * either one. Runs from the Cron Trigger in wrangler.toml via the `scheduled`
 * handler in index.ts; safe to also call by hand (e.g. before a risky change).
 */
export async function runNightlyBackup(env: Env): Promise<{ key: string; sizeBytes: number }> {
  const db = getDb(env);

  const [
    patientRows,
    appointmentRows,
    treatmentRows,
    invoiceRows,
    invoiceItemRows,
    paymentRows,
    fileRows,
    reminderRows,
    staffRows,
  ] = await Promise.all([
    db.select().from(patients),
    db.select().from(appointments),
    db.select().from(treatmentRecords),
    db.select().from(invoices),
    db.select().from(invoiceItems),
    db.select().from(payments),
    db.select().from(files),
    db.select().from(reminders),
    db.select().from(staff),
  ]);

  const exportedAt = new Date().toISOString();
  const snapshot = {
    exportedAt,
    tables: {
      patients: patientRows,
      appointments: appointmentRows,
      treatmentRecords: treatmentRows,
      invoices: invoiceRows,
      invoiceItems: invoiceItemRows,
      payments: paymentRows,
      files: fileRows,
      reminders: reminderRows,
      staff: staffRows,
    },
  };

  const body = JSON.stringify(snapshot);
  const key = `backups/${exportedAt.slice(0, 10)}.json`;
  await env.FILES.put(key, body, { httpMetadata: { contentType: "application/json" } });

  await pruneOldBackups(env);
  return { key, sizeBytes: body.length };
}

async function pruneOldBackups(env: Env): Promise<void> {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const listed = await env.FILES.list({ prefix: "backups/" });
  for (const object of listed.objects) {
    const match = object.key.match(BACKUP_KEY_PATTERN);
    if (!match) continue;
    const fileDate = new Date(`${match[1]}T00:00:00Z`).getTime();
    if (fileDate < cutoff) {
      await env.FILES.delete(object.key);
    }
  }
}
