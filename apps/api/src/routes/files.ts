import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { FILE_TYPES, idParamSchema } from "@clinic/shared";
import { getDb } from "../db/client.js";
import { files, patients } from "../db/schema.js";
import { badRequest, notFound } from "../lib/responses.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import type { AppContext } from "../types.js";

export const fileRoutes = new Hono<AppContext>();
fileRoutes.use("*", requireAuth);

// X-rays and scanned documents only; no arbitrary file types.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const listQuerySchema = z.object({ patientId: idParamSchema.shape.id });

function toFile(row: typeof files.$inferSelect) {
  return {
    id: row.id,
    patientId: row.patientId,
    type: row.type,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    notes: row.notes,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

fileRoutes.get("/", validate("query", listQuerySchema), async (c) => {
  const { patientId } = c.req.valid("query");
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.patientId, patientId), isNull(files.deletedAt)))
    .orderBy(desc(files.uploadedAt));
  return c.json({ items: rows.map(toFile) });
});

fileRoutes.get("/:id", validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)))
    .limit(1);
  if (!row) throw notFound("File");
  return c.json({ item: toFile(row) });
});

fileRoutes.get("/:id/download", validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)))
    .limit(1);
  if (!row) throw notFound("File");

  const object = await c.env.FILES.get(row.r2Key);
  if (!object) throw notFound("File contents");

  return new Response(object.body, {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

// Uploads go straight from the browser to this endpoint and are written to R2
// via the Worker's binding — no presigned URLs or separate S3 credentials to
// manage. This does mean an upload needs an active connection; the offline
// outbox (apps/web) only queues JSON mutations, not file bytes (see
// docs/architecture.md "Known limitations").
fileRoutes.post("/", async (c) => {
  const user = c.get("currentUser");
  const form = await c.req.formData();

  const patientId = form.get("patientId");
  const type = form.get("type");
  const notes = form.get("notes");
  const file = form.get("file");

  if (typeof patientId !== "string" || !patientId) throw badRequest("patientId is required");
  if (typeof type !== "string" || !(FILE_TYPES as readonly string[]).includes(type)) {
    throw badRequest(`type must be one of: ${FILE_TYPES.join(", ")}`);
  }
  if (!(file instanceof File)) throw badRequest("A file is required");
  if (file.size === 0) throw badRequest("The file is empty");
  if (file.size > MAX_FILE_BYTES) throw badRequest("Files must be 25MB or smaller");
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw badRequest(`Unsupported file type: ${file.type || "unknown"}. Allowed: JPEG, PNG, WEBP, HEIC, PDF`);
  }

  const db = getDb(c.env);
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patient) throw notFound("Patient");

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 150) || "file";
  const r2Key = `patients/${patientId}/${id}-${safeName}`;

  await c.env.FILES.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const now = new Date().toISOString();
  await db.insert(files).values({
    id,
    patientId,
    type,
    fileName: file.name,
    r2Key,
    mimeType: file.type,
    sizeBytes: file.size,
    notes: typeof notes === "string" && notes ? notes : null,
    uploadedBy: user.id,
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);
  return c.json({ item: toFile(row!) }, 201);
});

// Only admin can delete an uploaded file - a doctor or front-desk account
// should never be able to remove evidence (an X-ray, a photo) from a
// patient's record. See the ROLES comment in constants.ts.
fileRoutes.delete("/:id", requireRole("admin"), validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c.env);
  const [existing] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)))
    .limit(1);
  if (!existing) throw notFound("File");

  // Soft delete only: the R2 object is left in place (cheap at this volume) so
  // a mistaken delete is always recoverable by a doctor from R2 directly.
  await db.update(files).set({ deletedAt: new Date().toISOString() }).where(eq(files.id, id));
  return c.json({ ok: true });
});
