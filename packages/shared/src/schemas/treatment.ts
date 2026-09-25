import { z } from "zod";
import { FDI_PERMANENT_TEETH, TOOTH_CONDITIONS } from "../constants.js";
import { idSchema, isoDateSchema, optionalString, timestampsSchema } from "./common.js";

export const toothNumberSchema = z.enum(
  FDI_PERMANENT_TEETH as [string, ...string[]],
);

export const treatmentStatusSchema = z.enum(["planned", "completed"]);

export const treatmentRecordSchema = z
  .object({
    id: idSchema,
    patientId: idSchema,
    appointmentId: idSchema.nullable(),
    toothNumber: toothNumberSchema.nullable(),
    condition: z.enum(TOOTH_CONDITIONS).nullable(),
    procedure: z.string().min(1).max(200),
    notes: z.string().max(4000).nullable(),
    prescription: z.string().max(2000).nullable(),
    status: treatmentStatusSchema,
    date: isoDateSchema,
    staffId: idSchema,
  })
  .merge(timestampsSchema);
export type TreatmentRecord = z.infer<typeof treatmentRecordSchema>;

export const createTreatmentRecordSchema = z.object({
  id: idSchema.optional(),
  patientId: idSchema,
  appointmentId: optionalString(idSchema),
  toothNumber: optionalString(toothNumberSchema),
  condition: optionalString(z.enum(TOOTH_CONDITIONS)),
  procedure: z.string().min(1).max(200),
  notes: z.string().max(4000).optional(),
  prescription: z.string().max(2000).optional(),
  status: treatmentStatusSchema.default("completed"),
  date: isoDateSchema,
  staffId: idSchema,
});
export type CreateTreatmentRecordInput = z.infer<typeof createTreatmentRecordSchema>;

export const updateTreatmentRecordSchema = createTreatmentRecordSchema
  .omit({ id: true, patientId: true })
  .partial();
export type UpdateTreatmentRecordInput = z.infer<typeof updateTreatmentRecordSchema>;

export const treatmentListQuerySchema = z.object({
  patientId: idSchema,
  toothNumber: toothNumberSchema.optional(),
  status: treatmentStatusSchema.optional(),
});
export type TreatmentListQuery = z.infer<typeof treatmentListQuerySchema>;

/** One row per FDI tooth number, reflecting the most recent recorded condition for that patient. */
export const toothChartEntrySchema = z.object({
  toothNumber: toothNumberSchema,
  condition: z.enum(TOOTH_CONDITIONS),
  lastTreatmentRecordId: idSchema.nullable(),
  lastUpdated: isoDateSchema.nullable(),
});
export type ToothChartEntry = z.infer<typeof toothChartEntrySchema>;
