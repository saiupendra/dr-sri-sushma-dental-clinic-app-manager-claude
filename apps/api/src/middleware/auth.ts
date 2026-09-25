import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Role } from "@clinic/shared";
import { getDb } from "../db/client.js";
import { SESSION_COOKIE_NAME, verifySession } from "../lib/session.js";
import { forbidden, unauthorized } from "../lib/responses.js";
import type { AppContext } from "../types.js";

/** Verifies the session cookie and attaches the current user; throws 401 otherwise. */
export const requireAuth = createMiddleware<AppContext>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) throw unauthorized();

  const db = getDb(c.env);
  const user = await verifySession(db, token);
  if (!user) throw unauthorized();

  c.set("currentUser", user);
  await next();
});

/** Restricts a route to specific roles. Must run after requireAuth. */
export function requireRole(...roles: Role[]) {
  return createMiddleware<AppContext>(async (c, next) => {
    const user = c.get("currentUser");
    if (!roles.includes(user.role)) {
      throw forbidden(`This action requires the role: ${roles.join(" or ")}`);
    }
    await next();
  });
}
