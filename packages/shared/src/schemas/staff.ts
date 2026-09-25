import { z } from "zod";
import { ROLES } from "../constants.js";
import { idSchema, timestampsSchema } from "./common.js";

export const staffPublicSchema = z
  .object({
    id: idSchema,
    username: z.string().min(3).max(40),
    name: z.string().min(1).max(120),
    role: z.enum(ROLES),
    phone: z.string().max(20).nullable(),
    isActive: z.boolean(),
  })
  .merge(timestampsSchema);
export type StaffPublic = z.infer<typeof staffPublicSchema>;

export const createStaffSchema = z.object({
  id: idSchema.optional(),
  username: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9._-]+$/i, "Letters, numbers, dot, underscore, hyphen only"),
  name: z.string().min(1).max(120),
  role: z.enum(ROLES),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(200),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  phone: z.string().max(20).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

/** POST /api/auth/bootstrap: the first account is always a doctor, so it takes no role field. */
export const bootstrapStaffSchema = createStaffSchema.omit({ role: true });
export type BootstrapStaffInput = z.infer<typeof bootstrapStaffSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});
