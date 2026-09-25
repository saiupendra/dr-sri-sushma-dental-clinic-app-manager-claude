import { eq } from "drizzle-orm";
import type { StaffPublic } from "@clinic/shared";
import type { Db } from "../db/client.js";
import { sessions, staff } from "../db/schema.js";
import { randomToken, sha256Hex } from "./crypto.js";

export const SESSION_COOKIE_NAME = "clinic_session";
export const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export function toStaffPublic(row: typeof staff.$inferSelect): StaffPublic {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role as StaffPublic["role"],
    phone: row.phone,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createSession(
  db: Db,
  staffId: string,
  userAgent?: string | null,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const now = new Date().toISOString();
  await db.insert(sessions).values({
    id: tokenHash,
    staffId,
    userAgent: userAgent ?? null,
    lastUsedAt: now,
    expiresAt,
  });
  return { token, expiresAt };
}

/** Returns the authenticated, active staff member for a raw session token, or null. */
export async function verifySession(db: Db, token: string): Promise<StaffPublic | null> {
  const tokenHash = await sha256Hex(token);
  const [row] = await db
    .select({ session: sessions, staff })
    .from(sessions)
    .innerJoin(staff, eq(sessions.staffId, staff.id))
    .where(eq(sessions.id, tokenHash))
    .limit(1);

  if (!row) return null;
  if (new Date(row.session.expiresAt).getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, tokenHash));
    return null;
  }
  if (!row.staff.isActive) return null;

  // Best-effort activity heartbeat for the admin "active sessions" view; not
  // security-critical, so a failure here should never break authentication.
  await db.update(sessions).set({ lastUsedAt: new Date().toISOString() }).where(eq(sessions.id, tokenHash));

  return toStaffPublic(row.staff);
}

export async function destroySession(db: Db, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await db.delete(sessions).where(eq(sessions.id, tokenHash));
}

/** Deletes every session for a staff member, e.g. after a password reset or deactivation. */
export async function destroyAllSessionsForStaff(db: Db, staffId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.staffId, staffId));
}

export function sessionCookieOptions(env: { COOKIE_DOMAIN: string }, maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "Lax" as const,
    path: "/",
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: maxAgeSeconds,
  };
}
