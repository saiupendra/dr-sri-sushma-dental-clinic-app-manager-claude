import { z } from "zod";
import { APPOINTMENT_STATUSES } from "../constants.js";
import { idSchema, isoDateTimeSchema, timestampsSchema } from "./common.js";

export const appointmentSchema = z
  .object({
    id: idSchema,
    patientId: idSchema,
    staffId: idSchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    status: z.enum(APPOINTMENT_STATUSES),
    reasonNote: z.string().max(1000).nullable(),
    createdBy: idSchema.nullable(),
  })
  .merge(timestampsSchema);
export type Appointment = z.infer<typeof appointmentSchema>;

export const createAppointmentSchema = z
  .object({
    id: idSchema.optional(),
    patientId: idSchema,
    staffId: idSchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    status: z.enum(APPOINTMENT_STATUSES).default("scheduled"),
    reasonNote: z.string().max(1000).optional(),
  })
  .refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  patientId: idSchema.optional(),
  staffId: idSchema.optional(),
  startAt: isoDateTimeSchema.optional(),
  endAt: isoDateTimeSchema.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  reasonNote: z.string().max(1000).nullable().optional(),
});
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

/** What the list/detail endpoints actually return: the appointment plus a couple of read-only, denormalized patient fields so the UI never has to N+1 a lookup per row. */
export const appointmentWithPatientSchema = appointmentSchema.extend({
  patientName: z.string(),
  patientPhone: z.string(),
  staffName: z.string(),
});
export type AppointmentWithPatient = z.infer<typeof appointmentWithPatientSchema>;

export const appointmentListQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  patientId: idSchema.optional(),
  staffId: idSchema.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;
