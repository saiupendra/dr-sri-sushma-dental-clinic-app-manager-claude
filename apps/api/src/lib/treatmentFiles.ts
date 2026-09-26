import { and, inArray, isNull } from "drizzle-orm";
import type { FileType } from "@clinic/shared";
import type { Db } from "../db/client.js";
import { files } from "../db/schema.js";
import { badRequest } from "./responses.js";

/**
 * treatment_records stores its photo-id lists as a JSON-encoded array in a
 * single text column rather than a join table - they're only ever read or
 * written alongside their one treatment record, never queried on their own,
 * so a join table would add a table and joins for no real benefit here.
 */
export function encodeFileIds(ids: string[]): string {
  return JSON.stringify(ids);
}

export function decodeFileIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Every id in `fileIds` must already be an uploaded, non-deleted file of
 * `type` belonging to `patientId` - mirrors the single-file check this
 * replaced, just over a list. Throws a 400 naming `label` on any mismatch.
 */
export async function assertOwnedPatientFiles(
  db: Db,
  fileIds: string[],
  patientId: string,
  type: FileType,
  label: string,
): Promise<void> {
  if (fileIds.length === 0) return;
  const rows = await db
    .select({ id: files.id, patientId: files.patientId, type: files.type })
    .from(files)
    .where(and(inArray(files.id, fileIds), isNull(files.deletedAt)));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const id of fileIds) {
    const row = byId.get(id);
    if (!row || row.patientId !== patientId || row.type !== type) {
      throw badRequest(`${label} must be uploaded ${type.replace(/_/g, " ")} photos for this patient`);
    }
  }
}
