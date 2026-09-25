import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
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
import { SESSION_COOKIE_NAME, SESSION_IDLE_TIMEOUT_SECONDS } from "../lib/session.js";
import { validate } from "../lib/validate.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import type { AppContext } from "../types.js";

export const adminRoutes = new Hono<AppContext>();

// Admin-only: session/device visibility, storage totals, and the bulk
// patient-data export are system/operations concerns, not clinical ones -
// doctors (and of course front-desk) don't get this, same as admin never
// gets clinical write access. See the ROLES comment in constants.ts.
adminRoutes.use("*", requireAuth, requireRole("admin"));

// Session ids are a sha256 hex digest of the token (see lib/session.ts), not
// a UUID, so this can't reuse the shared idParamSchema.
const sessionIdParamSchema = z.object({ id: z.string().min(32).max(128) });

adminRoutes.get("/sessions", async (c) => {
  const db = getDb(c.env);
  const currentToken = getCookie(c, SESSION_COOKIE_NAME);
  const currentTokenHash = currentToken ? await sha256Hex(currentToken) : undefined;

  // Idle-expired sessions are only deleted lazily, on their next use
  // (verifySession) - sweep them here too, so this view never shows a
  // session as active when its owner has already been logged out of it.
  const idleCutoff = new Date(Date.now() - SESSION_IDLE_TIMEOUT_SECONDS * 1000).toISOString();
  await db.delete(sessions).where(lt(sessions.lastUsedAt, idleCutoff));

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

function patientFolderName(patient: { id: string; name: string }): string {
  const safeName = patient.name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 60) || "patient";
  return `patients/${safeName}_${patient.id.slice(0, 8)}`;
}

// One folder per patient, covering every patient-related record plus the
// actual uploaded files (X-rays, photos, documents - pulled from R2, not
// just their metadata). Staff accounts are still excluded - this is a
// patient-data export, not an account/system backup (that's the separate
// nightly backup feature).
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

  const invoiceIdsByPatient = new Map<string, Set<string>>();
  for (const invoice of invoiceRows) {
    const set = invoiceIdsByPatient.get(invoice.patientId) ?? new Set<string>();
    set.add(invoice.id);
    invoiceIdsByPatient.set(invoice.patientId, set);
  }

  const zipInput: Record<string, Uint8Array> = {};

  for (const patient of patientRows) {
    const folder = patientFolderName(patient);
    const patientInvoiceIds = invoiceIdsByPatient.get(patient.id) ?? new Set<string>();

    zipInput[`${folder}/profile.csv`] = strToU8(
      toCsv([patient], [
        "id",
        "name",
        "phone",
        "email",
        "dateOfBirth",
        "sex",
        "address",
        "medicalHistoryNotes",
        "heightFeet",
        "weightKg",
        "bloodPressure",
        "bloodSugar",
        "consultationFee",
        "createdBy",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ]),
    );
    zipInput[`${folder}/appointments.csv`] = strToU8(
      toCsv(
        appointmentRows.filter((a) => a.patientId === patient.id),
        ["id", "patientId", "staffId", "startAt", "endAt", "status", "reasonNote", "createdBy", "createdAt", "updatedAt", "deletedAt"],
      ),
    );
    zipInput[`${folder}/treatments.csv`] = strToU8(
      toCsv(
        treatmentRows.filter((t) => t.patientId === patient.id),
        ["id", "patientId", "appointmentId", "toothNumber", "condition", "procedure", "notes", "prescription", "status", "date", "staffId", "createdAt", "updatedAt", "deletedAt"],
      ),
    );
    zipInput[`${folder}/invoices.csv`] = strToU8(
      toCsv(
        invoiceRows.filter((i) => i.patientId === patient.id),
        ["id", "patientId", "status", "date", "totalAmount", "amountPaid", "notes", "createdBy", "createdAt", "updatedAt", "deletedAt"],
      ),
    );
    zipInput[`${folder}/invoice_items.csv`] = strToU8(
      toCsv(
        invoiceItemRows.filter((item) => patientInvoiceIds.has(item.invoiceId)),
        ["id", "invoiceId", "treatmentRecordId", "description", "amount"],
      ),
    );
    zipInput[`${folder}/payments.csv`] = strToU8(
      toCsv(
        paymentRows.filter((p) => patientInvoiceIds.has(p.invoiceId)),
        ["id", "invoiceId", "amount", "method", "paidAt", "note", "recordedBy", "createdAt"],
      ),
    );
    zipInput[`${folder}/reminders.csv`] = strToU8(
      toCsv(
        reminderRows.filter((r) => r.patientId === patient.id),
        ["id", "appointmentId", "patientId", "channel", "status", "message", "scheduledFor", "sentAt", "sentBy", "createdAt", "updatedAt"],
      ),
    );

    const patientFiles = fileRows.filter((f) => f.patientId === patient.id);
    zipInput[`${folder}/files.csv`] = strToU8(
      toCsv(patientFiles, ["id", "type", "fileName", "mimeType", "sizeBytes", "notes", "uploadedBy", "uploadedAt", "createdAt", "updatedAt", "deletedAt"]),
    );
  }

  // Fetch every file's actual bytes from R2 concurrently, after the CSVs are
  // queued, so one missing/slow object can't hold up the rest of the export.
  const fileFetches = await Promise.all(
    fileRows.map(async (file) => {
      const object = await c.env.FILES.get(file.r2Key);
      if (!object) return null; // metadata exists but the R2 object is gone - skip it, don't fail the whole export
      const patient = patientRows.find((p) => p.id === file.patientId);
      if (!patient) return null; // orphaned file row (patient hard-deleted, if that ever happens) - nothing to file it under
      const safeName = file.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const path = `${patientFolderName(patient)}/files/${file.id.slice(0, 8)}_${safeName}`;
      return { path, bytes: new Uint8Array(await object.arrayBuffer()) };
    }),
  );
  for (const entry of fileFetches) {
    if (entry) zipInput[entry.path] = entry.bytes;
  }

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
