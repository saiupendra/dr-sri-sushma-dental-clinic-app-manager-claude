import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  createTreatmentRecordSchema,
  idParamSchema,
  treatmentListQuerySchema,
  updateTreatmentRecordSchema,
  updateTreatmentStatusSchema,
} from "@clinic/shared";
import { getDb } from "../db/client.js";
import { files, treatmentRecords } from "../db/schema.js";
import { badRequest, notFound } from "../lib/responses.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import type { AppContext } from "../types.js";

export const treatmentRoutes = new Hono<AppContext>();
treatmentRoutes.use("*", requireAuth);

function toTreatment(row: typeof treatmentRecords.$inferSelect) {
  return {
    id: row.id,
    patientId: row.patientId,
    appointmentId: row.appointmentId,
    toothNumber: row.toothNumber,
    condition: row.condition,
    conditionOther: row.conditionOther,
    procedure: row.procedure,
    notes: row.notes,
    prescription: row.prescription,
    status: row.status,
    date: row.date,
    staffId: row.staffId,
    beforeTreatmentFileId: row.beforeTreatmentFileId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

treatmentRoutes.get("/", validate("query", treatmentListQuerySchema), async (c) => {
  const { patientId, toothNumber, status } = c.req.valid("query");
  const db = getDb(c.env);

  const conditions = [eq(treatmentRecords.patientId, patientId), isNull(treatmentRecords.deletedAt)];
  if (toothNumber) conditions.push(eq(treatmentRecords.toothNumber, toothNumber));
  if (status) conditions.push(eq(treatmentRecords.status, status));

  const rows = await db
    .select()
    .from(treatmentRecords)
    .where(and(...conditions))
    .orderBy(desc(treatmentRecords.date), desc(treatmentRecords.createdAt));

  return c.json({ items: rows.map(toTreatment) });
});

treatmentRoutes.get("/:id", validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [row] = await db
    .select()
    .from(treatmentRecords)
    .where(and(eq(treatmentRecords.id, id), isNull(treatmentRecords.deletedAt)))
    .limit(1);
  if (!row) throw notFound("Treatment record");
  return c.json({ item: toTreatment(row) });
});

// Clinical entries are doctor-only to write: Dr.Sri Sushma leads all treatment
// at this clinic, and front-desk staff should never author clinical notes.
// Front-desk can still read them (e.g. to build an invoice from completed work).
treatmentRoutes.post(
  "/",
  requireRole("doctor"),
  validate("json", createTreatmentRecordSchema),
  async (c) => {
    const input = c.req.valid("json");
    const db = getDb(c.env);

    const [photo] = await db
      .select({ id: files.id, patientId: files.patientId, type: files.type })
      .from(files)
      .where(and(eq(files.id, input.beforeTreatmentFileId), isNull(files.deletedAt)))
      .limit(1);
    if (!photo || photo.patientId !== input.patientId || photo.type !== "before_treatment") {
      throw badRequest("beforeTreatmentFileId must be an uploaded before-treatment photo for this patient");
    }

    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .insert(treatmentRecords)
      .values({
        id,
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        toothNumber: input.toothNumber ?? null,
        condition: input.condition,
        conditionOther: input.condition === "other" ? (input.conditionOther ?? null) : null,
        procedure: input.procedure,
        notes: input.notes ?? null,
        prescription: input.prescription ?? null,
        status: input.status,
        date: input.date,
        staffId: input.staffId,
        beforeTreatmentFileId: input.beforeTreatmentFileId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: treatmentRecords.id });

    const [row] = await db.select().from(treatmentRecords).where(eq(treatmentRecords.id, id)).limit(1);
    return c.json({ item: toTreatment(row!) }, 201);
  },
);

// Doctor keeps the one everyday edit to a saved record - flipping its
// status as work actually happens - so charting and invoicing (which
// requires a completed treatment) don't need an admin in the loop for
// routine visits. Anything else about a saved record is admin-only, below.
treatmentRoutes.patch(
  "/:id/status",
  requireRole("admin", "doctor"),
  validate("param", idParamSchema),
  validate("json", updateTreatmentStatusSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const db = getDb(c.env);

    const [existing] = await db
      .select({ id: treatmentRecords.id })
      .from(treatmentRecords)
      .where(and(eq(treatmentRecords.id, id), isNull(treatmentRecords.deletedAt)))
      .limit(1);
    if (!existing) throw notFound("Treatment record");

    await db
      .update(treatmentRecords)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(treatmentRecords.id, id));

    const [row] = await db.select().from(treatmentRecords).where(eq(treatmentRecords.id, id)).limit(1);
    return c.json({ item: toTreatment(row!) });
  },
);

// Editing the content of an already-saved note (as opposed to just its
// status, above) is admin-only: neither the doctor nor front-desk should be
// able to alter a clinical record after the fact without going through the
// admin account, so a correction is always deliberate and accountable.
treatmentRoutes.patch(
  "/:id",
  requireRole("admin"),
  validate("param", idParamSchema),
  validate("json", updateTreatmentRecordSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const db = getDb(c.env);

    const [existing] = await db
      .select({ id: treatmentRecords.id })
      .from(treatmentRecords)
      .where(and(eq(treatmentRecords.id, id), isNull(treatmentRecords.deletedAt)))
      .limit(1);
    if (!existing) throw notFound("Treatment record");

    // Never leave a stale "other" description behind once the condition is
    // changed away from "other" (the client isn't required to clear it itself).
    const conditionOther = input.condition && input.condition !== "other" ? null : input.conditionOther;

    await db
      .update(treatmentRecords)
      .set({ ...input, conditionOther, updatedAt: new Date().toISOString() })
      .where(eq(treatmentRecords.id, id));

    const [row] = await db.select().from(treatmentRecords).where(eq(treatmentRecords.id, id)).limit(1);
    return c.json({ item: toTreatment(row!) });
  },
);

// Deleting a saved clinical record is admin-only - unlike creating one
// (doctor-only) or toggling its status (admin+doctor). Once something is
// saved, only admin can remove it; see the RBAC table in docs/architecture.md.
treatmentRoutes.delete("/:id", requireRole("admin"), validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [existing] = await db
    .select({ id: treatmentRecords.id })
    .from(treatmentRecords)
    .where(and(eq(treatmentRecords.id, id), isNull(treatmentRecords.deletedAt)))
    .limit(1);
  if (!existing) throw notFound("Treatment record");

  await db
    .update(treatmentRecords)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(treatmentRecords.id, id));
  return c.json({ ok: true });
});
