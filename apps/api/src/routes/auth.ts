import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { bootstrapStaffSchema, changePasswordSchema, loginRequestSchema } from "@clinic/shared";
import { getDb } from "../db/client.js";
import { staff } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../lib/crypto.js";
import { badRequest, unauthorized } from "../lib/responses.js";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSession,
  destroyAllSessionsForStaff,
  destroySession,
  sessionCookieOptions,
  toStaffPublic,
} from "../lib/session.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import type { AppContext } from "../types.js";

export const authRoutes = new Hono<AppContext>();

async function startSession(c: Context<AppContext>, db: ReturnType<typeof getDb>, staffId: string) {
  const { token } = await createSession(db, staffId);
  setCookie(c, SESSION_COOKIE_NAME, token, sessionCookieOptions(c.env, SESSION_TTL_SECONDS));
}

/**
 * One-time setup: creates the first doctor account. Only works while the
 * staff table is empty, so it can never be used to add a second account —
 * after that, staff creation goes through POST /api/staff (doctor-only).
 */
authRoutes.post("/bootstrap", validate("json", bootstrapStaffSchema), async (c) => {
  const db = getDb(c.env);
  const existing = await db.select({ id: staff.id }).from(staff).limit(1);
  if (existing.length > 0) {
    throw badRequest("Setup has already been completed. Ask a doctor account holder to add staff.");
  }

  const input = c.req.valid("json");
  const { hash, salt } = await hashPassword(input.password);
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(staff).values({
    id,
    username: input.username.toLowerCase(),
    name: input.name,
    role: "doctor",
    phone: input.phone ?? null,
    passwordHash: hash,
    passwordSalt: salt,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await startSession(c, db, id);
  const [row] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  return c.json({ user: toStaffPublic(row!) }, 201);
});

authRoutes.get("/bootstrap-status", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select({ id: staff.id }).from(staff).limit(1);
  return c.json({ needsBootstrap: rows.length === 0 });
});

authRoutes.post("/login", validate("json", loginRequestSchema), async (c) => {
  const { username, password } = c.req.valid("json");
  const db = getDb(c.env);

  const [row] = await db
    .select()
    .from(staff)
    .where(eq(staff.username, username.toLowerCase()))
    .limit(1);

  // Same generic message whether the username or password is wrong, and
  // whether the account exists at all, so login can't be used to enumerate staff.
  if (!row || !row.isActive) throw unauthorized("Invalid username or password");

  const valid = await verifyPassword(password, row.passwordHash, row.passwordSalt);
  if (!valid) throw unauthorized("Invalid username or password");

  await startSession(c, db, row.id);
  return c.json({ user: toStaffPublic(row) });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  const db = getDb(c.env);
  if (token) await destroySession(db, token);
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/", domain: c.env.COOKIE_DOMAIN || undefined });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, async (c) => {
  return c.json({ user: c.get("currentUser") });
});

authRoutes.post("/change-password", requireAuth, validate("json", changePasswordSchema), async (c) => {
  const { currentPassword, newPassword } = c.req.valid("json");
  const user = c.get("currentUser");
  const db = getDb(c.env);

  const [row] = await db.select().from(staff).where(eq(staff.id, user.id)).limit(1);
  if (!row) throw unauthorized();

  const valid = await verifyPassword(currentPassword, row.passwordHash, row.passwordSalt);
  if (!valid) throw badRequest("Current password is incorrect");

  const { hash, salt } = await hashPassword(newPassword);
  await db
    .update(staff)
    .set({ passwordHash: hash, passwordSalt: salt, updatedAt: new Date().toISOString() })
    .where(eq(staff.id, user.id));

  // Changing your password signs out every other session; start a fresh one for this request.
  await destroyAllSessionsForStaff(db, user.id);
  await startSession(c, db, user.id);
  return c.json({ ok: true });
});
