import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { desc, eq, gt, isNull, sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { z } from "zod";
import type { SessionSummary, StorageStats } from "@clinic/shared";
import { getDb } from "../db/client.js";
import {
  appointments,
  files,
  invoiceItems,
  invoices,
  patients,
  payments,
  reminders,
  sessions,
  staff,
  treatmentRecords,
} from "../db/schema.js";
import { sha256Hex } from "../lib/crypto.js";
import { toCsv } from "../lib/csv.js";
import { notFound } from "../lib/responses.js";
import { SESSION_COOKIE_NAME } from "../lib/session.js";
import { validate } from "../lib/validate.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import type { AppContext } from "../types.js";

export const adminRoutes = new Hono<AppContext>();

// Everything here is doctor-only: session/device visibility, storage totals,
// and the bulk patient-data export are all things front-desk should never see.
adminRoutes.use("*", requireAuth, requireRole("doctor"));

// Session ids are a sha256 hex digest of the token (see lib/session.ts), not
// a UUID, so this can't reuse the shared idParamSchema.
const sessionIdParamSchema = z.object({ id: z.string().min(32).max(128) });

adminRoutes.get("/sessions", async (c) => {
  const db = getDb(c.env);
  const currentToken = getCookie(c, SESSION_COOKIE_NAME);
  const currentTokenHash = currentToken ? await sha256Hex(currentToken) : undefined;

  const rows = await db
    .select({ session: sessions, staff })
    .from(sessions)
    .innerJoin(staff, eq(sessions.staffId, staff.id))
    .where(gt(sessions.expiresAt, new Date().toISOString()))
    .orderBy(desc(sessions.lastUsedAt));

  const items: SessionSummary[] = rows.map(({ session, staff: staffRow }) => ({
    id: session.id,
    staffId: staffRow.id,
    staffName: staffRow.name,
    staffRole: staffRow.role,
    userAgent: session.userAgent,
    isCurrent: session.id === currentTokenHash,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
  }));
  return c.json({ items });
});

adminRoutes.delete("/sessions/:id", validate("param", sessionIdParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);

  const [existing] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!existing) throw notFound("Session");

  await db.delete(sessions).where(eq(sessions.id, id));
  return c.json({ ok: true });
});

adminRoutes.get("/storage", async (c) => {
  const db = getDb(c.env);
  const [row] = await db
    .select({
      fileCount: sql<number>`count(*)`,
      totalBytes: sql<number>`coalesce(sum(${files.sizeBytes}), 0)`,
    })
    .from(files)
    .where(isNull(files.deletedAt));

  const stats: StorageStats = { fileCount: row?.fileCount ?? 0, totalBytes: row?.totalBytes ?? 0 };
  return c.json(stats);
});

// A ZIP of one CSV per table, covering every patient-related record (not
// staff accounts, and not the uploaded files themselves — file *metadata* is
// included, but the binary contents stay in R2; see /storage for totals).
adminRoutes.get("/export", async (c) => {
  const db = getDb(c.env);
  const [patientRows, appointmentRows, treatmentRows, invoiceRows, invoiceItemRows, paymentRows, fileRows, reminderRows] =
    await Promise.all([
      db.select().from(patients),
      db.select().from(appointments),
      db.select().from(treatmentRecords),
      db.select().from(invoices),
      db.select().from(invoiceItems),
      db.select().from(payments),
      db.select().from(files),
      db.select().from(reminders),
    ]);

  const zipInput: Record<string, Uint8Array> = {
    "patients.csv": strToU8(
      toCsv(patientRows, [
        "id",
        "name",
        "phone",
        "email",
        "dateOfBirth",
        "sex",
        "address",
        "medicalHistoryNotes",
        "createdBy",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ]),
    ),
    "appointments.csv": strToU8(
      toCsv(appointmentRows, [
        "id",
        "patientId",
        "staffId",
        "startAt",
        "endAt",
        "status",
        "reasonNote",
        "createdBy",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ]),
    ),
    "treatments.csv": strToU8(
      toCsv(treatmentRows, [
        "id",
        "patientId",
        "appointmentId",
        "toothNumber",
        "condition",
        "procedure",
        "notes",
        "prescription",
        "status",
        "date",
        "staffId",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ]),
    ),
    "invoices.csv": strToU8(
      toCsv(invoiceRows, [
        "id",
        "patientId",
        "status",
        "date",
        "totalAmount",
        "amountPaid",
        "notes",
        "createdBy",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ]),
    ),
    "invoice_items.csv": strToU8(
      toCsv(invoiceItemRows, ["id", "invoiceId", "treatmentRecordId", "description", "amount"]),
    ),
    "payments.csv": strToU8(
      toCsv(paymentRows, ["id", "invoiceId", "amount", "method", "paidAt", "note", "recordedBy", "createdAt"]),
    ),
    "files.csv": strToU8(
      toCsv(fileRows, [
        "id",
        "patientId",
        "type",
        "fileName",
        "mimeType",
        "sizeBytes",
        "notes",
        "uploadedBy",
        "uploadedAt",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ]),
    ),
    "reminders.csv": strToU8(
      toCsv(reminderRows, [
        "id",
        "appointmentId",
        "patientId",
        "channel",
        "status",
        "message",
        "scheduledFor",
        "sentAt",
        "sentBy",
        "createdAt",
        "updatedAt",
      ]),
    ),
  };

  const zipped = zipSync(zipInput, { level: 6 });
  const dateStr = new Date().toISOString().slice(0, 10);
  return new Response(zipped, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="patient-records-${dateStr}.zip"`,
      "Content-Length": String(zipped.byteLength),
    },
  });
});
