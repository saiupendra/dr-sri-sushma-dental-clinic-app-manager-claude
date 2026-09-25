import { z } from "zod";
import { FILE_TYPES } from "../constants.js";
import { idSchema, isoDateTimeSchema, timestampsSchema } from "./common.js";

export const fileRecordSchema = z
  .object({
    id: idSchema,
    patientId: idSchema,
    type: z.enum(FILE_TYPES),
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(120),
    sizeBytes: z.number().int().nonnegative(),
    notes: z.string().max(1000).nullable(),
    uploadedBy: idSchema,
    uploadedAt: isoDateTimeSchema,
  })
  .merge(timestampsSchema);
export type FileRecord = z.infer<typeof fileRecordSchema>;

/** Requested before upload; the API returns an id + R2 key for the client to PUT bytes to. */
export const createFileUploadSchema = z.object({
  id: idSchema.optional(),
  patientId: idSchema,
  type: z.enum(FILE_TYPES),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024, "Max 25MB per file"),
  notes: z.string().max(1000).optional(),
});
export type CreateFileUploadInput = z.infer<typeof createFileUploadSchema>;

export const fileUploadResponseSchema = z.object({
  file: fileRecordSchema,
  uploadUrl: z.string(),
});
