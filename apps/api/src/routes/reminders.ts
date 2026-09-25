import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createReminderSchema, idParamSchema, markReminderSentSchema } from "@clinic/shared";
import { getDb } from "../db/client.js";
import { appointments, patients, reminders } from "../db/schema.js";
import { badRequest, notFound } from "../lib/responses.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import { buildWhatsAppUrl, defaultReminderMessage } from "../lib/whatsapp.js";
import type { AppContext } from "../types.js";

export const reminderRoutes = new Hono<AppContext>();
reminderRoutes.use("*", requireAuth);

const listQuerySchema = z.object({ appointmentId: idParamSchema.shape.id });

reminderRoutes.get("/", validate("query", listQuerySchema), async (c) => {
  const { appointmentId } = c.req.valid("query");
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.appointmentId, appointmentId))
    .orderBy(desc(reminders.createdAt));
  return c.json({ items: rows });
});

// The one-tap WhatsApp flow: create (or log) a reminder and hand back a
// wa.me link the frontend opens immediately. Nothing is sent automatically —
// staff review the pre-filled message in WhatsApp before hitting send there.
reminderRoutes.post("/", validate("json", createReminderSchema), async (c) => {
  const input = c.req.valid("json");
  const db = getDb(c.env);

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, input.appointmentId))
    .limit(1);
  if (!appointment) throw notFound("Appointment");

  const [patient] = await db.select().from(patients).where(eq(patients.id, appointment.patientId)).limit(1);
  if (!patient) throw notFound("Patient");
  if (!patient.phone) throw badRequest("This patient has no phone number on file");

  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const message = input.message ?? defaultReminderMessage(patient.name, appointment.startAt);
  const scheduledFor = input.scheduledFor ?? appointment.startAt;

  await db
    .insert(reminders)
    .values({
      id,
      appointmentId: input.appointmentId,
      patientId: appointment.patientId,
      channel: input.channel,
      status: "pending",
      message,
      scheduledFor,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: reminders.id });

  const [row] = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
  const whatsappUrl = buildWhatsAppUrl(patient.phone, row!.message);

  return c.json({ reminder: row, whatsappUrl }, 201);
});

reminderRoutes.patch(
  "/:id/sent",
  validate("param", idParamSchema),
  validate("json", markReminderSentSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const user = c.get("currentUser");
    const db = getDb(c.env);

    const [existing] = await db.select({ id: reminders.id }).from(reminders).where(eq(reminders.id, id)).limit(1);
    if (!existing) throw notFound("Reminder");

    const sentAt = input.sentAt ?? new Date().toISOString();
    await db
      .update(reminders)
      .set({ status: "sent", sentAt, sentBy: user.id, updatedAt: new Date().toISOString() })
      .where(eq(reminders.id, id));

    const [row] = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
    return c.json({ item: row });
  },
);
