import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";
import { badRequest } from "./responses.js";

/** Wraps @hono/zod-validator so every validation failure returns our standard error envelope. */
export function validate<T extends z.ZodTypeAny>(target: "json" | "query" | "param", schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw badRequest("Invalid request", result.error.flatten());
    }
  });
}
