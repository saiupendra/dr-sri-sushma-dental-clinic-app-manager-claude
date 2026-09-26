import { z } from "zod";
import { APPOINTMENT_STATUSES } from "../constants.js";
import { idSchema, isoDateSchema, isoDateTimeSchema, optionalString, requiredCoercedNumber, timestampsSchema } from "./common.js";

export const sexSchema = z.enum(["male", "female", "other", "unspecified"]);

const PHONE_REGEX = /^\d{10}$/;

export const patientSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(150),
    phone: z.string().regex(PHONE_REGEX, "Phone number must be exactly 10 digits"),
    email: z.string().email().max(150).nullable(),
    dateOfBirth: isoDateSchema.nullable(),
    sex: sexSchema,
    address: z.string().max(500).nullable(),
    medicalHistoryNotes: z.string().max(4000).nullable(),
    heightFeet: z.number().min(0).max(9).nullable(),
    weightKg: z.number().min(0).max(300).nullable(),
    bloodPressure: z.string().max(50).nullable(),
    bloodSugar: z.string().max(100).nullable(),
    consultationFee: z.number().min(0).nullable(),
    createdBy: idSchema.nullable(),
  })
  .merge(timestampsSchema);
export type Patient = z.infer<typeof patientSchema>;

export const createPatientSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1).max(150),
  phone: z.string().regex(PHONE_REGEX, "Phone number must be exactly 10 digits"),
  email: optionalString(z.string().email().max(150)),
  dateOfBirth: optionalString(isoDateSchema),
  sex: sexSchema.default("unspecified"),
  address: z.string().trim().min(1, "Address is required").max(500),
  medicalHistoryNotes: z.string().trim().min(1, "Medical history notes are required").max(4000),
  heightFeet: optionalString(z.coerce.number().min(0).max(9)),
  weightKg: optionalString(z.coerce.number().min(0).max(300)),
  bloodPressure: optionalString(z.string().max(50)),
  bloodSugar: optionalString(z.string().max(100)),
  consultationFee: requiredCoercedNumber(z.coerce.number().min(0)),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema
  .omit({ id: true })
  .partial();
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

/**
 * What the list endpoint actually returns: the patient plus a few read-only,
 * denormalized fields (next appointment, last completed visit, outstanding
 * balance) so the patients list can show useful context with no per-row N+1
 * lookup. The detail endpoint (GET /api/patients/:id) still returns a plain
 * `patientSchema` item - these are list-only.
 */
export const patientListItemSchema = patientSchema.extend({
  nextAppointment: z
    .object({
      id: idSchema,
      startAt: isoDateTimeSchema,
      status: z.enum(APPOINTMENT_STATUSES),
    })
    .nullable(),
  lastVisitAt: isoDateTimeSchema.nullable(),
  balanceDue: z.number(),
});
export type PatientListItem = z.infer<typeof patientListItemSchema>;
