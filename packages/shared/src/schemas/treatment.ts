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
    // Set server-side at creation (today) - never client-supplied. See
    // completedDate below for the clinically meaningful "done" date.
    date: isoDateSchema,
    // Set only once, by PATCH /:id/complete - the actual date the work was
    // performed, as opposed to `date` (when the plan was recorded).
    completedDate: isoDateSchema.nullable(),
    postTreatmentNotes: z.string().max(4000).nullable(),
    staffId: idSchema,
    // Every record has at least one pre-operative photo (required at
    // creation); after-treatment photos exist only once completed.
    beforeTreatmentFileIds: z.array(idSchema),
    afterTreatmentFileIds: z.array(idSchema),
  })
  .merge(timestampsSchema);
export type TreatmentRecord = z.infer<typeof treatmentRecordSchema>;

// Creation always starts a record as "planned" - there is no way to create
// one pre-completed. Completion is a separate, evidence-requiring step (see
// completeTreatmentRecordSchema) the doctor performs once the work is done.
const treatmentRecordCreateShape = z.object({
  id: idSchema.optional(),
  patientId: idSchema,
  appointmentId: optionalString(idSchema),
  toothNumber: optionalString(toothNumberSchema),
  condition: z.enum(TOOTH_CONDITIONS),
  conditionOther: z.string().max(200).optional(),
  procedure: z.string().min(1).max(200),
  notes: z.string().min(1).max(4000),
  prescription: z.string().min(1).max(2000),
  staffId: idSchema,
  // Each id must already be an uploaded before_treatment photo for this
  // patient (see the files route) - the client uploads first, then refers
  // to it here.
  beforeTreatmentFileIds: z.array(idSchema).min(1, "Add at least one pre-operative photo"),
});

export const createTreatmentRecordSchema = treatmentRecordCreateShape.refine(
  (data) => data.condition !== "other" || !!data.conditionOther?.trim(),
  { message: "Describe the condition", path: ["conditionOther"] },
);
export type CreateTreatmentRecordInput = z.infer<typeof createTreatmentRecordSchema>;

// Admin-only correction of an already-saved record's content (see
// requireRole("admin") on PATCH /api/treatments/:id) - status and its
// completion evidence go through their own dedicated endpoints instead, not
// this one.
export const updateTreatmentRecordSchema = z.object({
  appointmentId: optionalString(idSchema),
  toothNumber: optionalString(toothNumberSchema),
  condition: z.enum(TOOTH_CONDITIONS).optional(),
  conditionOther: z.string().max(200).optional(),
  procedure: z.string().min(1).max(200).optional(),
  notes: z.string().min(1).max(4000).optional(),
  prescription: z.string().min(1).max(2000).optional(),
  date: isoDateSchema.optional(),
});
export type UpdateTreatmentRecordInput = z.infer<typeof updateTreatmentRecordSchema>;

/**
 * PATCH /api/treatments/:id/complete - the one-way move from planned to
 * completed. Post-operative photos, post-operative notes and the date the
 * treatment was actually done are all mandatory: this is the clinical
 * record of what was done, not just a status flip. There is deliberately no
 * endpoint to move status back to "planned" once completed - see the route.
 */
export const completeTreatmentRecordSchema = z.object({
  completedDate: isoDateSchema,
  postTreatmentNotes: z.string().trim().min(1, "Add post-operative notes"),
  afterTreatmentFileIds: z.array(idSchema).min(1, "Add at least one post-operative photo"),
});
export type CompleteTreatmentRecordInput = z.infer<typeof completeTreatmentRecordSchema>;

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
