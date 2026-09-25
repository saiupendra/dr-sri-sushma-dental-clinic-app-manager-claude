import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { createStaffSchema, idParamSchema, resetPasswordSchema, updateStaffSchema } from "@clinic/shared";
import { getDb } from "../db/client.js";
import { staff } from "../db/schema.js";
import { hashPassword } from "../lib/crypto.js";
import { badRequest, forbidden, notFound } from "../lib/responses.js";
import { destroyAllSessionsForStaff, toStaffPublic } from "../lib/session.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import type { AppContext } from "../types.js";

export const staffRoutes = new Hono<AppContext>();

// Listing is open to every signed-in role, because front-desk needs it to
// staff the appointment picker - but an admin account is never in that list
// for anyone except another admin. Creating, editing and resetting a
// password are doctor-and-up, and a doctor's reach there stops at front-desk
// accounts: never an admin, and never another doctor (or their own doctor
// account - that's done through /api/auth/change-password). Admin is
// unrestricted throughout. See the ROLES comment in constants.ts.
staffRoutes.use("*", requireAuth);

staffRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const user = c.get("currentUser");
  const rows = await db.select().from(staff).orderBy(desc(staff.createdAt));
  const visible = user.role === "admin" ? rows : rows.filter((row) => row.role !== "admin");
  return c.json({ items: visible.map(toStaffPublic) });
});

staffRoutes.post("/", requireRole("admin", "doctor"), validate("json", createStaffSchema), async (c) => {
  const input = c.req.valid("json");
  const user = c.get("currentUser");
  if (user.role === "doctor" && input.role !== "front_desk") {
    throw forbidden("Doctors can only create front-desk accounts. Ask an admin to add a doctor or admin account.");
  }
  const db = getDb(c.env);

  const [dup] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(eq(staff.username, input.username.toLowerCase()))
    .limit(1);
  if (dup) throw badRequest("That username is already taken");

  const { hash, salt } = await hashPassword(input.password);
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(staff).values({
    id,
    username: input.username.toLowerCase(),
    name: input.name,
    role: input.role,
    phone: input.phone ?? null,
    passwordHash: hash,
    passwordSalt: salt,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const [row] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  return c.json({ item: toStaffPublic(row!) }, 201);
});

staffRoutes.patch("/:id", requireRole("admin", "doctor"), validate("param", idParamSchema), validate("json", updateStaffSchema), async (c) => {
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const user = c.get("currentUser");
  const db = getDb(c.env);

  const [existing] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  if (!existing) throw notFound("Staff member");

  if (user.role === "doctor" && (existing.role !== "front_desk" || (input.role && input.role !== "front_desk"))) {
    throw forbidden("Doctors can only manage front-desk accounts.");
  }

  await db
    .update(staff)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(staff.id, id));

  // Deactivating an account should end its sessions immediately, not at next expiry.
  if (input.isActive === false) {
    await destroyAllSessionsForStaff(db, id);
  }

  const [row] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  return c.json({ item: toStaffPublic(row!) });
});

staffRoutes.post("/:id/reset-password", requireRole("admin", "doctor"), validate("param", idParamSchema), validate("json", resetPasswordSchema), async (c) => {
  const id = c.req.param("id");
  const { password } = c.req.valid("json");
  const user = c.get("currentUser");
  const db = getDb(c.env);

  const [existing] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  if (!existing) throw notFound("Staff member");

  if (user.role === "doctor" && existing.role !== "front_desk") {
    throw forbidden("Doctors can only reset front-desk passwords.");
  }

  const { hash, salt } = await hashPassword(password);
  await db
    .update(staff)
    .set({ passwordHash: hash, passwordSalt: salt, updatedAt: new Date().toISOString() })
    .where(eq(staff.id, id));

  // Force re-login everywhere with the new password.
  await destroyAllSessionsForStaff(db, id);
  return c.json({ ok: true });
});
