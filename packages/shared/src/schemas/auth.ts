import { z } from "zod";
import { staffPublicSchema } from "./staff.js";

export const loginRequestSchema = z.object({
  username: z.string().min(1).max(40),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  user: staffPublicSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const meResponseSchema = z.object({
  user: staffPublicSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});
