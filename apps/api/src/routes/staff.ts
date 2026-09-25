import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { createStaffSchema, idParamSchema, resetPasswordSchema, updateStaffSchema } from "@clinic/shared";
import { getDb } from "../db/client.js";
import { staff } from "../db/schema.js";
import { hashPassword } from "../lib/crypto.js";
import { badRequest, notFound } from "../lib/responses.js";
import { destroyAllSessionsForStaff, toStaffPublic } from "../lib/session.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import type { AppContext } from "../types.js";

export const staffRoutes = new Hono<AppContext>();

// Every route in this file is doctor-only: staff accounts and roles are
// sensitive, and front-desk users must never be able to create or elevate one.
staffRoutes.use("*", requireAuth, requireRole("doctor"));

staffRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(staff).orderBy(desc(staff.createdAt));
  return c.json({ items: rows.map(toStaffPublic) });
});

staffRoutes.post("/", validate("json", createStaffSchema), async (c) => {
  const input = c.req.valid("json");
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

staffRoutes.patch("/:id", validate("param", idParamSchema), validate("json", updateStaffSchema), async (c) => {
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const db = getDb(c.env);

  const [existing] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  if (!existing) throw notFound("Staff member");

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

staffRoutes.post("/:id/reset-password", validate("param", idParamSchema), validate("json", resetPasswordSchema), async (c) => {
  const id = c.req.param("id");
  const { password } = c.req.valid("json");
  const db = getDb(c.env);

  const [existing] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  if (!existing) throw notFound("Staff member");

  const { hash, salt } = await hashPassword(password);
  await db
    .update(staff)
    .set({ passwordHash: hash, passwordSalt: salt, updatedAt: new Date().toISOString() })
    .where(eq(staff.id, id));

  // Force re-login everywhere with the new password.
  await destroyAllSessionsForStaff(db, id);
  return c.json({ ok: true });
});
