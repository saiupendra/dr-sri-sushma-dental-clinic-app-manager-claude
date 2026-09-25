import { Hono } from "hono";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  createInvoiceSchema,
  idParamSchema,
  invoiceListQuerySchema,
  recordPaymentSchema,
  updateInvoiceSchema,
} from "@clinic/shared";
import type { InvoiceStatus } from "@clinic/shared";
import { getDb, type Db } from "../db/client.js";
import { invoiceItems, invoices, payments, treatmentRecords } from "../db/schema.js";
import { deriveInvoiceStatus } from "../lib/billing.js";
import { badRequest, conflict, notFound } from "../lib/responses.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import type { AppContext } from "../types.js";

export const invoiceRoutes = new Hono<AppContext>();
invoiceRoutes.use("*", requireAuth);

async function loadInvoiceDetail(db: Db, id: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .limit(1);
  if (!invoice) return null;

  const [items, invoicePayments] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)),
    db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paidAt)),
  ]);

  return {
    id: invoice.id,
    patientId: invoice.patientId,
    status: invoice.status,
    date: invoice.date,
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    notes: invoice.notes,
    createdBy: invoice.createdBy,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    items,
    payments: invoicePayments,
  };
}

invoiceRoutes.get("/", validate("query", invoiceListQuerySchema), async (c) => {
    const { page, pageSize, patientId } = c.req.valid("query");
    const db = getDb(c.env);
    const offset = (page - 1) * pageSize;

    const whereClause = patientId
      ? and(isNull(invoices.deletedAt), eq(invoices.patientId, patientId))
      : isNull(invoices.deletedAt);

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(whereClause)
        .orderBy(desc(invoices.date), desc(invoices.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: sql<number>`count(*)` }).from(invoices).where(whereClause),
    ]);

    return c.json({ items: rows, page, pageSize, total: totalRows[0]?.total ?? 0 });
});

invoiceRoutes.get("/:id", validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const detail = await loadInvoiceDetail(db, id);
  if (!detail) throw notFound("Invoice");
  return c.json({ item: detail });
});

invoiceRoutes.post("/", validate("json", createInvoiceSchema), async (c) => {
  const input = c.req.valid("json");
  const db = getDb(c.env);
  const user = c.get("currentUser");

  // Fees are only known once a treatment has actually happened - block
  // invoicing a patient who has none completed yet, rather than letting a
  // speculative invoice get created ahead of the work.
  const [completedTreatment] = await db
    .select({ id: treatmentRecords.id })
    .from(treatmentRecords)
    .where(
      and(
        eq(treatmentRecords.patientId, input.patientId),
        eq(treatmentRecords.status, "completed"),
        isNull(treatmentRecords.deletedAt),
      ),
    )
    .limit(1);
  if (!completedTreatment) {
    throw badRequest("This patient has no completed treatment yet. Add or complete a treatment note before creating an invoice.");
  }

  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const totalAmount = input.items.reduce((sum, item) => sum + item.amount, 0);

  const itemRows = input.items.map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    invoiceId: id,
    treatmentRecordId: item.treatmentRecordId ?? null,
    description: item.description,
    amount: item.amount,
  }));

  // D1's batch() runs every statement as one atomic transaction, so an invoice
  // is never left without its line items if the Worker is interrupted partway.
  // Its type wants a fixed-length tuple; ours is built from a variable number
  // of items, so we assert the shape rather than fight the tuple inference.
  const statements = [
    db.insert(invoices).values({
      id,
      patientId: input.patientId,
      status: "unpaid",
      date: now,
      totalAmount,
      amountPaid: 0,
      notes: input.notes ?? null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing({ target: invoices.id }),
    ...itemRows.map((row) =>
      db.insert(invoiceItems).values(row).onConflictDoNothing({ target: invoiceItems.id }),
    ),
  ];
  await db.batch(statements as unknown as [(typeof statements)[number]]);

  const detail = await loadInvoiceDetail(db, id);
  return c.json({ item: detail }, 201);
});

invoiceRoutes.patch(
  "/:id",
  validate("param", idParamSchema),
  validate("json", updateInvoiceSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const db = getDb(c.env);

    const [existing] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
      .limit(1);
    if (!existing) throw notFound("Invoice");

    let totalAmount = existing.totalAmount;

    if (input.items) {
      totalAmount = input.items.reduce((sum, item) => sum + item.amount, 0);
      const itemRows = input.items.map((item) => ({
        id: item.id ?? crypto.randomUUID(),
        invoiceId: id,
        treatmentRecordId: item.treatmentRecordId ?? null,
        description: item.description,
        amount: item.amount,
      }));
      const statements = [
        db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)),
        ...itemRows.map((row) => db.insert(invoiceItems).values(row)),
      ];
      await db.batch(statements as unknown as [(typeof statements)[number]]);
    }

    const status =
      input.status ?? deriveInvoiceStatus(totalAmount, existing.amountPaid, existing.status as InvoiceStatus);

    await db
      .update(invoices)
      .set({
        totalAmount,
        status,
        notes: input.notes === undefined ? existing.notes : input.notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, id));

    const detail = await loadInvoiceDetail(db, id);
    return c.json({ item: detail });
  },
);

invoiceRoutes.post(
  "/:id/payments",
  validate("param", idParamSchema),
  validate("json", recordPaymentSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const db = getDb(c.env);
    const user = c.get("currentUser");

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
      .limit(1);
    if (!invoice) throw notFound("Invoice");
    if (invoice.status === "cancelled") throw conflict("Cannot record a payment on a cancelled invoice");

    const paymentId = input.id ?? crypto.randomUUID();
    const paidAt = input.paidAt ?? new Date().toISOString();
    const newAmountPaid = invoice.amountPaid + input.amount;
    const newStatus = deriveInvoiceStatus(invoice.totalAmount, newAmountPaid, invoice.status as InvoiceStatus);

    const statements = [
      db.insert(payments).values({
        id: paymentId,
        invoiceId: id,
        amount: input.amount,
        method: input.method,
        paidAt,
        note: input.note ?? null,
        recordedBy: user.id,
        createdAt: new Date().toISOString(),
      }).onConflictDoNothing({ target: payments.id }),
      db.update(invoices).set({ amountPaid: newAmountPaid, status: newStatus, updatedAt: new Date().toISOString() }).where(eq(invoices.id, id)),
    ];
    await db.batch(statements as unknown as [(typeof statements)[number]]);

    const detail = await loadInvoiceDetail(db, id);
    return c.json({ item: detail }, 201);
  },
);

invoiceRoutes.delete("/:id/payments/:paymentId", async (c) => {
  const id = c.req.param("id");
  const paymentId = c.req.param("paymentId");
  const db = getDb(c.env);

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) throw notFound("Invoice");

  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.invoiceId, id)))
    .limit(1);
  if (!payment) throw notFound("Payment");

  const newAmountPaid = Math.max(0, invoice.amountPaid - payment.amount);
  const newStatus = deriveInvoiceStatus(invoice.totalAmount, newAmountPaid, invoice.status as InvoiceStatus);

  const statements = [
    db.delete(payments).where(eq(payments.id, paymentId)),
    db.update(invoices).set({ amountPaid: newAmountPaid, status: newStatus, updatedAt: new Date().toISOString() }).where(eq(invoices.id, id)),
  ];
  await db.batch(statements as unknown as [(typeof statements)[number]]);

  const detail = await loadInvoiceDetail(db, id);
  return c.json({ item: detail });
});

invoiceRoutes.delete("/:id", validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [existing] = await db
    .select({ id: invoices.id, amountPaid: invoices.amountPaid })
    .from(invoices)
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .limit(1);
  if (!existing) throw notFound("Invoice");
  if (existing.amountPaid > 0) {
    throw badRequest("Cannot delete an invoice that already has payments recorded against it; cancel it instead");
  }

  await db.update(invoices).set({ deletedAt: new Date().toISOString() }).where(eq(invoices.id, id));
  return c.json({ ok: true });
});
