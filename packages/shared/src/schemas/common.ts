import { z } from "zod";

/** Client-generated UUID primary key. Clients (incl. offline) generate this with crypto.randomUUID(); the API is idempotent on it so a retried offline sync never creates a duplicate row. */
export const idSchema = z.string().uuid();

/** Matches Hono's c.req.param() shape for routes with a single :id segment. */
export const idParamSchema = z.object({ id: idSchema });

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const timestampsSchema = z.object({
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

/** Standard error envelope returned by every API error response. */
/**
 * An optional field backed by a format-constrained string (email, a date
 * regex, an enum...). Plain HTML inputs submit "" when left blank, not
 * undefined, and `.optional()` alone only excuses undefined — so `z.string()
 * .email().optional()` rejects an empty field as an invalid email. This
 * treats "" the same as "not provided" before the inner schema ever sees it.
 */
export function optionalString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === "" ? undefined : val), schema.optional());
}

/**
 * A required numeric field backed by a plain HTML number input. Left blank,
 * such an input submits "" - which z.coerce.number() would otherwise
 * silently coerce to 0 (Number("") === 0), defeating "required". This
 * rejects "" as missing instead, so a blank field fails validation.
 */
export function requiredCoercedNumber(schema: z.ZodNumber) {
  return z.preprocess((val) => (val === "" ? undefined : val), schema);
}

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
