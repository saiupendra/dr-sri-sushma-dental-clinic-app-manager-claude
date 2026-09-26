import { Hono } from "hono";
import { and, eq, gt, isNull, lt, ne, notInArray } from "drizzle-orm";
import {
  appointmentListQuerySchema,
  createAppointmentSchema,
  idParamSchema,
  updateAppointmentSchema,
} from "@clinic/shared";
import { getDb, type Db } from "../db/client.js";
import { appointments, patients, reminders, staff } from "../db/schema.js";
import { badRequest, conflict, notFound } from "../lib/responses.js";
import { rangesOverlap } from "../lib/scheduling.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import { formatIstDateTime } from "../lib/whatsapp.js";
import { isWhatsAppCloudApiConfigured, sendWhatsAppTemplateMessage } from "../lib/whatsappCloudApi.js";
import type { AppContext } from "../types.js";

export const appointmentRoutes = new Hono<AppContext>();
appointmentRoutes.use("*", requireAuth);

// Cancelled/no-show/rescheduled slots free up the calendar, so they never block a new booking.
const STATUSES_EXCLUDED_FROM_CONFLICT_CHECK = ["cancelled", "no_show", "rescheduled"];

function toAppointment(row: typeof appointments.$inferSelect) {
  return {
    id: row.id,
    patientId: row.patientId,
    staffId: row.staffId,
    startAt: row.startAt,
    endAt: row.endAt,
    status: row.status,
    reasonNote: row.reasonNote,
    rescheduledToAppointmentId: row.rescheduledToAppointmentId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The clinician a patient is booked with must actually be a doctor - a
 * front-desk account can create/edit the appointment itself, but was never
 * meant to be the one it's booked "with". See docs/architecture.md's RBAC
 * table and constants.ts's ROLES comment.
 */
async function assertStaffIsDoctor(db: Db, staffId: string): Promise<void> {
  const [row] = await db.select({ role: staff.role }).from(staff).where(eq(staff.id, staffId)).limit(1);
  if (!row || row.role !== "doctor") {
    throw badRequest("An appointment can only be booked with a doctor");
  }
}

/** Adds read-only patient/staff names so the UI never has to look them up per row. */
async function withPatientAndStaff(db: Db, appointmentId: string) {
  const [row] = await db
    .select({
      appointment: appointments,
      patientName: patients.name,
      patientPhone: patients.phone,
      staffName: staff.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .where(and(eq(appointments.id, appointmentId), isNull(appointments.deletedAt)))
    .limit(1);
  if (!row) return null;
  return {
    ...toAppointment(row.appointment),
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    staffName: row.staffName,
  };
}

/**
 * True if staffId already has an overlapping, active appointment in
 * [startAt, endAt). The lt/gt in the WHERE clause is D1's coarse pre-filter
 * (so this never scans a staff member's whole calendar); rangesOverlap is the
 * actual, unit-tested overlap rule and is what the pre-filter must agree with.
 */
async function hasConflict(
  db: Db,
  staffId: string,
  startAt: string,
  endAt: string,
  excludeId?: string,
): Promise<boolean> {
  const conditions = [
    eq(appointments.staffId, staffId),
    isNull(appointments.deletedAt),
    notInArray(appointments.status, STATUSES_EXCLUDED_FROM_CONFLICT_CHECK),
    lt(appointments.startAt, endAt),
    gt(appointments.endAt, startAt),
  ];
  if (excludeId) conditions.push(ne(appointments.id, excludeId));

  const rows = await db
    .select({ startAt: appointments.startAt, endAt: appointments.endAt })
    .from(appointments)
    .where(and(...conditions));
  return rows.some((row) => rangesOverlap(row.startAt, row.endAt, startAt, endAt));
}

/**
 * Fires the zero-touch WhatsApp message the moment an appointment becomes
 * completed - no "send reminder" button for staff to click. Requires a real
 * Meta WhatsApp Cloud API account and an already-approved template (see
 * lib/whatsappCloudApi.ts); until that's configured this silently no-ops,
 * same as if the feature didn't exist yet. Always logged to the reminders
 * table (status "sent" or "failed") so the outcome is visible on the
 * appointment page exactly like a manually-sent one, with no staff member
 * as sentBy since nobody clicked anything.
 */
async function sendAutomaticCompletionMessage(
  db: Db,
  env: AppContext["Bindings"],
  appointmentId: string,
  patientId: string,
  patientPhone: string,
  patientName: string,
  startAt: string,
): Promise<void> {
  if (!isWhatsAppCloudApiConfigured(env)) return;

  const result = await sendWhatsAppTemplateMessage(env, patientPhone, [patientName, formatIstDateTime(startAt)]);
  const now = new Date().toISOString();
  await db.insert(reminders).values({
    id: crypto.randomUUID(),
    appointmentId,
    patientId,
    channel: "whatsapp",
    status: result.ok ? "sent" : "failed",
    message: result.ok
      ? `Automatic WhatsApp message sent for the completed appointment on ${formatIstDateTime(startAt)}.`
      : `Automatic WhatsApp message failed: ${result.error}`,
    scheduledFor: now,
    sentAt: result.ok ? now : null,
    sentBy: null,
    createdAt: now,
    updatedAt: now,
  });
}

appointmentRoutes.get("/", validate("query", appointmentListQuerySchema), async (c) => {
  const { from, to, patientId, staffId, status } = c.req.valid("query");
  const db = getDb(c.env);

  const conditions = [isNull(appointments.deletedAt)];
  if (from) conditions.push(gt(appointments.endAt, from));
  if (to) conditions.push(lt(appointments.startAt, to));
  if (patientId) conditions.push(eq(appointments.patientId, patientId));
  if (staffId) conditions.push(eq(appointments.staffId, staffId));
  if (status) conditions.push(eq(appointments.status, status));

  const rows = await db
    .select({
      appointment: appointments,
      patientName: patients.name,
      patientPhone: patients.phone,
      staffName: staff.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .where(and(...conditions))
    .orderBy(appointments.startAt);

  return c.json({
    items: rows.map((row) => ({
      ...toAppointment(row.appointment),
      patientName: row.patientName,
      patientPhone: row.patientPhone,
      staffName: row.staffName,
    })),
  });
});

appointmentRoutes.get("/:id", validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const item = await withPatientAndStaff(db, id);
  if (!item) throw notFound("Appointment");
  return c.json({ item });
});

appointmentRoutes.post("/", validate("json", createAppointmentSchema), async (c) => {
  const input = c.req.valid("json");
  const db = getDb(c.env);
  const user = c.get("currentUser");

  await assertStaffIsDoctor(db, input.staffId);

  const startAt = new Date(input.startAt).toISOString();
  const endAt = new Date(input.endAt).toISOString();

  if (!STATUSES_EXCLUDED_FROM_CONFLICT_CHECK.includes(input.status)) {
    if (await hasConflict(db, input.staffId, startAt, endAt)) {
      throw conflict("This staff member already has an appointment in that time slot");
    }
  }

  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(appointments)
    .values({
      id,
      patientId: input.patientId,
      staffId: input.staffId,
      startAt,
      endAt,
      status: input.status,
      reasonNote: input.reasonNote ?? null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: appointments.id });

  const item = await withPatientAndStaff(db, id);
  return c.json({ item }, 201);
});

appointmentRoutes.patch(
  "/:id",
  validate("param", idParamSchema),
  validate("json", updateAppointmentSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const db = getDb(c.env);

    const [existing] = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, id), isNull(appointments.deletedAt)))
      .limit(1);
    if (!existing) throw notFound("Appointment");

    if (input.staffId) await assertStaffIsDoctor(db, input.staffId);

    const staffId = input.staffId ?? existing.staffId;
    const startAt = input.startAt ? new Date(input.startAt).toISOString() : existing.startAt;
    const endAt = input.endAt ? new Date(input.endAt).toISOString() : existing.endAt;
    const status = input.status ?? existing.status;

    if (!STATUSES_EXCLUDED_FROM_CONFLICT_CHECK.includes(status)) {
      if (await hasConflict(db, staffId, startAt, endAt, id)) {
        throw conflict("This staff member already has an appointment in that time slot");
      }
    }

    await db
      .update(appointments)
      .set({ ...input, startAt, endAt, updatedAt: new Date().toISOString() })
      .where(eq(appointments.id, id));

    const item = await withPatientAndStaff(db, id);

    // Only on the transition into "completed", not every subsequent edit to
    // an already-completed appointment (e.g. a typo fix to its notes).
    if (item && existing.status !== "completed" && status === "completed") {
      await sendAutomaticCompletionMessage(db, c.env, id, item.patientId, item.patientPhone, item.patientName, item.startAt);
    }

    return c.json({ item });
  },
);

// Deleting is admin-only - unlike creating/editing an appointment (or just
// marking it cancelled/no-show), which stays open to every signed-in role.
// See the RBAC table in docs/architecture.md.
appointmentRoutes.delete("/:id", requireRole("admin"), validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [existing] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.id, id), isNull(appointments.deletedAt)))
    .limit(1);
  if (!existing) throw notFound("Appointment");

  await db.update(appointments).set({ deletedAt: new Date().toISOString() }).where(eq(appointments.id, id));
  return c.json({ ok: true });
});
