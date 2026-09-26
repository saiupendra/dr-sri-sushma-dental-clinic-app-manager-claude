import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  completeTreatmentRecordSchema,
  createTreatmentRecordSchema,
  idParamSchema,
  treatmentListQuerySchema,
  updateTreatmentRecordSchema,
} from "@clinic/shared";
import { getDb } from "../db/client.js";
import { treatmentRecords } from "../db/schema.js";
import { badRequest, notFound } from "../lib/responses.js";
import { assertOwnedPatientFiles, decodeFileIds, encodeFileIds } from "../lib/treatmentFiles.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import type { AppContext } from "../types.js";

export const treatmentRoutes = new Hono<AppContext>();
treatmentRoutes.use("*", requireAuth);

function toTreatment(row: typeof treatmentRecords.$inferSelect) {
  // Legacy rows saved before beforeTreatmentFileIds existed only ever had
  // the singular column - fall back to it so their one photo still shows.
  const beforeTreatmentFileIds = row.beforeTreatmentFileIds
    ? decodeFileIds(row.beforeTreatmentFileIds)
    : row.beforeTreatmentFileId
      ? [row.beforeTreatmentFileId]
      : [];
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
    completedDate: row.completedDate,
    postTreatmentNotes: row.postTreatmentNotes,
    staffId: row.staffId,
    beforeTreatmentFileIds,
    afterTreatmentFileIds: decodeFileIds(row.afterTreatmentFileIds),
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
// Every new record starts life as "planned" - see completeTreatmentRecordSchema
// for the separate, evidence-requiring step that moves it to "completed".
treatmentRoutes.post(
  "/",
  requireRole("doctor"),
  validate("json", createTreatmentRecordSchema),
  async (c) => {
    const input = c.req.valid("json");
    const db = getDb(c.env);

    await assertOwnedPatientFiles(
      db,
      input.beforeTreatmentFileIds,
      input.patientId,
      "before_treatment",
      "Pre-operative photos",
    );

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
        notes: input.notes,
        prescription: input.prescription,
        status: "planned",
        date: now.slice(0, 10),
        staffId: input.staffId,
        beforeTreatmentFileIds: encodeFileIds(input.beforeTreatmentFileIds),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: treatmentRecords.id });

    const [row] = await db.select().from(treatmentRecords).where(eq(treatmentRecords.id, id)).limit(1);
    return c.json({ item: toTreatment(row!) }, 201);
  },
);

// The one-way move from planned to completed. Post-operative photos,
// post-operative notes and the actual treatment-done date are all
// mandatory - this is the clinical record of what was done, not just a
// status flip - and there is deliberately no way back to "planned" once
// completed (see the guard below).
treatmentRoutes.patch(
  "/:id/complete",
  requireRole("admin", "doctor"),
  validate("param", idParamSchema),
  validate("json", completeTreatmentRecordSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const db = getDb(c.env);

    const [existing] = await db
      .select()
      .from(treatmentRecords)
      .where(and(eq(treatmentRecords.id, id), isNull(treatmentRecords.deletedAt)))
      .limit(1);
    if (!existing) throw notFound("Treatment record");
    if (existing.status === "completed") {
      throw badRequest("This treatment note is already marked completed and can't be reverted.");
    }

    await assertOwnedPatientFiles(
      db,
      input.afterTreatmentFileIds,
      existing.patientId,
      "after_treatment",
      "Post-operative photos",
    );

    await db
      .update(treatmentRecords)
      .set({
        status: "completed",
        completedDate: input.completedDate,
        postTreatmentNotes: input.postTreatmentNotes,
        afterTreatmentFileIds: encodeFileIds(input.afterTreatmentFileIds),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(treatmentRecords.id, id));

    const [row] = await db.select().from(treatmentRecords).where(eq(treatmentRecords.id, id)).limit(1);
    return c.json({ item: toTreatment(row!) });
  },
);

// Editing the content of an already-saved note (as opposed to completing it,
// above) is admin-only: neither the doctor nor front-desk should be able to
// alter a clinical record after the fact without going through the admin
// account, so a correction is always deliberate and accountable.
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
// (doctor-only) or completing it (admin+doctor). Once something is saved,
// only admin can remove it; see the RBAC table in docs/architecture.md.
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
