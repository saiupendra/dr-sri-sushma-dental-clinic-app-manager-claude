import { z } from "zod";
import { idSchema, isoDateSchema, optionalString, timestampsSchema } from "./common.js";

export const sexSchema = z.enum(["male", "female", "other", "unspecified"]);

export const patientSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(150),
    phone: z.string().min(6).max(20),
    email: z.string().email().max(150).nullable(),
    dateOfBirth: isoDateSchema.nullable(),
    sex: sexSchema,
    address: z.string().max(500).nullable(),
    medicalHistoryNotes: z.string().max(4000).nullable(),
    createdBy: idSchema.nullable(),
  })
  .merge(timestampsSchema);
export type Patient = z.infer<typeof patientSchema>;

export const createPatientSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1).max(150),
  phone: z.string().min(6).max(20),
  email: optionalString(z.string().email().max(150)),
  dateOfBirth: optionalString(isoDateSchema),
  sex: sexSchema.default("unspecified"),
  address: z.string().max(500).optional(),
  medicalHistoryNotes: z.string().max(4000).optional(),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema
  .omit({ id: true })
  .partial();
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
