import { z } from "zod";
import { ROLES } from "../constants.js";
import { idSchema } from "./common.js";

export const sessionSummarySchema = z.object({
  id: z.string(), // sha256 hex of the session token, not a UUID
  staffId: idSchema,
  staffName: z.string(),
  staffRole: z.enum(ROLES),
  userAgent: z.string().nullable(),
  isCurrent: z.boolean(),
  createdAt: z.string(),
  // Nullable at the DB level only for a brief window right after this column
  // was added (see schema.ts) - createSession()/verifySession() always set
  // it explicitly, so in practice this is never actually null.
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const storageStatsSchema = z.object({
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
});
export type StorageStats = z.infer<typeof storageStatsSchema>;
