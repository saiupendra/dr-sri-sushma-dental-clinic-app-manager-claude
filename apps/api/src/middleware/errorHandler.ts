import type { ErrorHandler, NotFoundHandler } from "hono";
import { ZodError } from "zod";
import { HttpError } from "../lib/responses.js";
import type { AppContext } from "../types.js";

/**
 * Central error handler: turns any thrown error into a clean JSON response
 * instead of letting one failed request take down the Worker's response.
 * Unexpected errors are logged (visible in `wrangler tail` / Cloudflare logs)
 * but never leak internal detail to the client.
 */
export const errorHandler: ErrorHandler<AppContext> = (err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status as never);
  }
  if (err instanceof ZodError) {
    return c.json(
      { error: { code: "validation_error", message: "Invalid request", details: err.flatten() } },
      400,
    );
  }
  console.error("Unhandled error", err);
  return c.json(
    { error: { code: "internal_error", message: "Something went wrong. Please try again." } },
    500,
  );
};

export const notFoundHandler: NotFoundHandler<AppContext> = (c) =>
  c.json({ error: { code: "not_found", message: "Not found" } }, 404);
