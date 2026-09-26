import { Hono } from "hono";
import { and, desc, eq, gte, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import {
  createPatientSchema,
  idParamSchema,
  paginationQuerySchema,
  updatePatientSchema,
} from "@clinic/shared";
import { getDb, type Db } from "../db/client.js";
import { appointments, invoices, patients } from "../db/schema.js";
import { notFound } from "../lib/responses.js";
import { getToothChart } from "../lib/toothChart.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import type { AppContext } from "../types.js";

export const patientRoutes = new Hono<AppContext>();
patientRoutes.use("*", requireAuth);

function toPatient(row: typeof patients.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    dateOfBirth: row.dateOfBirth,
    sex: row.sex,
    address: row.address,
    medicalHistoryNotes: row.medicalHistoryNotes,
    chiefComplaint: row.chiefComplaint,
    pastDentalHistory: row.pastDentalHistory,
    medicationsUsing: row.medicationsUsing,
    heightFeet: row.heightFeet,
    weightKg: row.weightKg,
    bloodPressure: row.bloodPressure,
    bloodSugar: row.bloodSugar,
    consultationFee: row.consultationFee,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Adds each patient's next upcoming appointment, most recent completed
 * visit, and outstanding invoice balance - scoped to just this page's
 * patient ids (never the whole table), so the patients list can show useful
 * context at a glance with no per-row N+1 lookup.
 */
async function loadVisitInfo(db: Db, patientIds: string[]) {
  type VisitInfo = {
    nextAppointment: { id: string; startAt: string; status: string } | null;
    lastVisitAt: string | null;
    balanceDue: number;
  };
  const result = new Map<string, VisitInfo>();
  if (patientIds.length === 0) return result;

  const now = new Date().toISOString();
  const [upcoming, lastVisits, balances] = await Promise.all([
    db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        startAt: appointments.startAt,
        status: appointments.status,
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.patientId, patientIds),
          isNull(appointments.deletedAt),
          gte(appointments.startAt, now),
          ne(appointments.status, "cancelled"),
          ne(appointments.status, "no_show"),
        ),
      )
      .orderBy(appointments.startAt),
    db
      .select({ patientId: appointments.patientId, lastVisitAt: sql<string>`max(${appointments.startAt})` })
      .from(appointments)
      .where(
        and(
          inArray(appointments.patientId, patientIds),
          isNull(appointments.deletedAt),
          eq(appointments.status, "completed"),
        ),
      )
      .groupBy(appointments.patientId),
    db
      .select({
        patientId: invoices.patientId,
        totalDue: sql<number>`sum(${invoices.totalAmount} - ${invoices.amountPaid})`,
      })
      .from(invoices)
      .where(and(inArray(invoices.patientId, patientIds), isNull(invoices.deletedAt), ne(invoices.status, "cancelled")))
      .groupBy(invoices.patientId),
  ]);

  // `upcoming` is ordered by startAt, so the first row seen per patient is their soonest appointment.
  const nextAppointmentByPatient = new Map<string, VisitInfo["nextAppointment"]>();
  for (const row of upcoming) {
    if (!nextAppointmentByPatient.has(row.patientId)) {
      nextAppointmentByPatient.set(row.patientId, { id: row.id, startAt: row.startAt, status: row.status });
    }
  }
  const lastVisitByPatient = new Map(lastVisits.map((row) => [row.patientId, row.lastVisitAt]));
  const balanceByPatient = new Map(balances.map((row) => [row.patientId, row.totalDue]));

  for (const id of patientIds) {
    result.set(id, {
      nextAppointment: nextAppointmentByPatient.get(id) ?? null,
      lastVisitAt: lastVisitByPatient.get(id) ?? null,
      balanceDue: Math.max(0, balanceByPatient.get(id) ?? 0),
    });
  }
  return result;
}

patientRoutes.get("/", validate("query", paginationQuerySchema), async (c) => {
  const { page, pageSize, search } = c.req.valid("query");
  const db = getDb(c.env);
  const offset = (page - 1) * pageSize;

  const whereClause = search
    ? and(
        isNull(patients.deletedAt),
        or(like(patients.name, `%${search}%`), like(patients.phone, `%${search}%`)),
      )
    : isNull(patients.deletedAt);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(patients)
      .where(whereClause)
      .orderBy(desc(patients.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(patients).where(whereClause),
  ]);

  const visitInfoByPatient = await loadVisitInfo(
    db,
    rows.map((row) => row.id),
  );
  const items = rows.map((row) => ({
    ...toPatient(row),
    ...(visitInfoByPatient.get(row.id) ?? { nextAppointment: null, lastVisitAt: null, balanceDue: 0 }),
  }));

  return c.json({ items, page, pageSize, total: totalRows[0]?.total ?? 0 });
});

patientRoutes.get("/:id", validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [row] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
    .limit(1);
  if (!row) throw notFound("Patient");
  return c.json({ item: toPatient(row) });
});

patientRoutes.post("/", validate("json", createPatientSchema), async (c) => {
  const input = c.req.valid("json");
  const db = getDb(c.env);
  const user = c.get("currentUser");
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(patients)
    .values({
      id,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      sex: input.sex,
      address: input.address,
      medicalHistoryNotes: input.medicalHistoryNotes,
      chiefComplaint: input.chiefComplaint,
      pastDentalHistory: input.pastDentalHistory,
      medicationsUsing: input.medicationsUsing,
      heightFeet: input.heightFeet ?? null,
      weightKg: input.weightKg ?? null,
      bloodPressure: input.bloodPressure ?? null,
      bloodSugar: input.bloodSugar ?? null,
      consultationFee: input.consultationFee ?? null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
    // Idempotent: an offline-queued create replayed twice (client id repeats) must not error or duplicate.
    .onConflictDoNothing({ target: patients.id });

  const [row] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
  return c.json({ item: toPatient(row!) }, 201);
});

patientRoutes.patch(
  "/:id",
  validate("param", idParamSchema),
  validate("json", updatePatientSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const db = getDb(c.env);

    const [existing] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
      .limit(1);
    if (!existing) throw notFound("Patient");

    await db
      .update(patients)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(patients.id, id));

    const [row] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    return c.json({ item: toPatient(row!) });
  },
);

patientRoutes.get("/:id/tooth-chart", validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
    .limit(1);
  if (!existing) throw notFound("Patient");

  const chart = await getToothChart(db, id);
  return c.json({ items: chart });
});

// Deleting is admin-only - unlike patient create/edit, which stays open to
// every signed-in role. See the RBAC table in docs/architecture.md.
patientRoutes.delete("/:id", requireRole("admin"), validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
    .limit(1);
  if (!existing) throw notFound("Patient");

  await db.update(patients).set({ deletedAt: new Date().toISOString() }).where(eq(patients.id, id));
  return c.json({ ok: true });
});
