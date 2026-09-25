import { z } from "zod";
import { REMINDER_CHANNELS, REMINDER_STATUSES } from "../constants.js";
import { idSchema, isoDateTimeSchema, timestampsSchema } from "./common.js";

export const reminderSchema = z
  .object({
    id: idSchema,
    appointmentId: idSchema,
    patientId: idSchema,
    channel: z.enum(REMINDER_CHANNELS),
    status: z.enum(REMINDER_STATUSES),
    message: z.string().min(1).max(1000),
    scheduledFor: isoDateTimeSchema,
    sentAt: isoDateTimeSchema.nullable(),
    sentBy: idSchema.nullable(),
  })
  .merge(timestampsSchema);
export type Reminder = z.infer<typeof reminderSchema>;

export const createReminderSchema = z.object({
  id: idSchema.optional(),
  appointmentId: idSchema,
  channel: z.enum(REMINDER_CHANNELS).default("whatsapp"),
  /** If omitted, the API fills in a default reminder message for the appointment. */
  message: z.string().min(1).max(1000).optional(),
  scheduledFor: isoDateTimeSchema.optional(),
});
export type CreateReminderInput = z.infer<typeof createReminderSchema>;

export const markReminderSentSchema = z.object({
  sentAt: isoDateTimeSchema.optional(),
});

/** Response for the one-tap WhatsApp flow: a ready-to-open wa.me deep link plus the reminder log entry. */
export const reminderSendLinkSchema = z.object({
  reminder: reminderSchema,
  whatsappUrl: z.string().url(),
});
