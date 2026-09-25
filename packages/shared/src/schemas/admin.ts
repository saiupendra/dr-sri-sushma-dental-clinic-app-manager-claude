import { z } from "zod";
import { idSchema } from "./common.js";

export const sessionSummarySchema = z.object({
  id: z.string(), // sha256 hex of the session token, not a UUID
  staffId: idSchema,
  staffName: z.string(),
  staffRole: z.string(),
  userAgent: z.string().nullable(),
  isCurrent: z.boolean(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  expiresAt: z.string(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const storageStatsSchema = z.object({
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
});
export type StorageStats = z.infer<typeof storageStatsSchema>;
