import { eq } from "drizzle-orm";
import type { StaffPublic } from "@clinic/shared";
import type { Db } from "../db/client.js";
import { sessions, staff } from "../db/schema.js";
import { randomToken, sha256Hex } from "./crypto.js";

export const SESSION_COOKIE_NAME = "clinic_session";
// Absolute cap on a session's lifetime regardless of activity - a rarely-hit
// safety net. The idle timeout below is what actually governs everyday logout.
export const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days
// A session with no request against it for this long is treated as logged
// out, even though its absolute expiresAt is far from reached. Both the DB
// row (verifySession) and the browser cookie (requireAuth, startSession) are
// checked/reissued against this value.
export const SESSION_IDLE_TIMEOUT_SECONDS = 15 * 60; // 15 minutes
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_TIMEOUT_SECONDS * 1000;

/** True once a session's absolute lifetime is up, regardless of activity. */
export function isSessionExpired(expiresAt: string, now: number): boolean {
  return new Date(expiresAt).getTime() < now;
}

/** True once a session has had no activity for longer than the idle timeout. */
export function isSessionIdle(lastActiveAt: string, now: number): boolean {
  return now - new Date(lastActiveAt).getTime() > SESSION_IDLE_TIMEOUT_MS;
}

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
  const now = Date.now();
  if (isSessionExpired(row.session.expiresAt, now)) {
    await db.delete(sessions).where(eq(sessions.id, tokenHash));
    return null;
  }

  // Sliding inactivity timeout: log out a session nobody has used in a
  // while, even though its absolute expiresAt hasn't been reached yet.
  // lastUsedAt is nullable only for rows old enough to predate that column;
  // createdAt is the right fallback for those.
  const lastActive = row.session.lastUsedAt ?? row.session.createdAt;
  if (isSessionIdle(lastActive, now)) {
    await db.delete(sessions).where(eq(sessions.id, tokenHash));
    return null;
  }

  if (!row.staff.isActive) return null;

  await db.update(sessions).set({ lastUsedAt: new Date(now).toISOString() }).where(eq(sessions.id, tokenHash));

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
