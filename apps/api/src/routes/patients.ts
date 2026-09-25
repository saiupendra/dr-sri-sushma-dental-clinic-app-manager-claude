import { Hono } from "hono";
import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import {
  createPatientSchema,
  idParamSchema,
  paginationQuerySchema,
  updatePatientSchema,
} from "@clinic/shared";
import { getDb } from "../db/client.js";
import { patients } from "../db/schema.js";
import { notFound } from "../lib/responses.js";
import { getToothChart } from "../lib/toothChart.js";
import { requireAuth } from "../middleware/auth.js";
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
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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

  return c.json({ items: rows.map(toPatient), page, pageSize, total: totalRows[0]?.total ?? 0 });
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
      address: input.address ?? null,
      medicalHistoryNotes: input.medicalHistoryNotes ?? null,
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

patientRoutes.delete("/:id", validate("param", idParamSchema), async (c) => {
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
