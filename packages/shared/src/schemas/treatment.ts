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
    // Free-text description, set only when condition is "other" - see the
    // .refine() on createTreatmentRecordSchema below.
    conditionOther: z.string().max(200).nullable(),
    procedure: z.string().min(1).max(200),
    notes: z.string().max(4000).nullable(),
    prescription: z.string().max(2000).nullable(),
    status: treatmentStatusSchema,
    date: isoDateSchema,
    staffId: idSchema,
    // Nullable only for records saved before this was required (see the
    // schema.ts column comment); every new record must set it.
    beforeTreatmentFileId: idSchema.nullable(),
  })
  .merge(timestampsSchema);
export type TreatmentRecord = z.infer<typeof treatmentRecordSchema>;

// Split from createTreatmentRecordSchema so .omit()/.partial() below (for the
// update schema) can still work - a ZodEffects (from .refine()) doesn't
// support those, so the refine is applied only to the create schema.
const treatmentRecordInputShape = z.object({
  id: idSchema.optional(),
  patientId: idSchema,
  appointmentId: optionalString(idSchema),
  toothNumber: optionalString(toothNumberSchema),
  condition: z.enum(TOOTH_CONDITIONS),
  conditionOther: z.string().max(200).optional(),
  procedure: z.string().min(1).max(200),
  notes: z.string().min(1).max(4000),
  prescription: z.string().min(1).max(2000),
  // Most notes are entered ahead of the actual work (see the appointment
  // link below), so "planned" is the more common case - "completed" is a
  // deliberate choice, made when work happens same-visit.
  status: treatmentStatusSchema.default("planned"),
  date: isoDateSchema,
  staffId: idSchema,
  // A before-treatment photo must already be uploaded (see the files route)
  // before it can be referenced here.
  beforeTreatmentFileId: idSchema,
});

export const createTreatmentRecordSchema = treatmentRecordInputShape.refine(
  (data) => data.condition !== "other" || !!data.conditionOther?.trim(),
  { message: "Describe the condition", path: ["conditionOther"] },
);
export type CreateTreatmentRecordInput = z.infer<typeof createTreatmentRecordSchema>;

export const updateTreatmentRecordSchema = treatmentRecordInputShape
  .omit({ id: true, patientId: true })
  .partial();
export type UpdateTreatmentRecordInput = z.infer<typeof updateTreatmentRecordSchema>;

/** PATCH /api/treatments/:id/status: the one edit a doctor can make to an existing record - see requireRole in treatments.ts. */
export const updateTreatmentStatusSchema = z.object({ status: treatmentStatusSchema });
export type UpdateTreatmentStatusInput = z.infer<typeof updateTreatmentStatusSchema>;

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
  conditionOther: z.string().nullable(),
  lastTreatmentRecordId: idSchema.nullable(),
  lastUpdated: isoDateSchema.nullable(),
});
export type ToothChartEntry = z.infer<typeof toothChartEntrySchema>;
