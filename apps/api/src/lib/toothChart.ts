import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { FDI_PERMANENT_TEETH, type ToothChartEntry } from "@clinic/shared";
import type { Db } from "../db/client.js";
import { treatmentRecords } from "../db/schema.js";

/**
 * The tooth chart has no table of its own: it is derived from the latest
 * dated, non-deleted treatment record recorded against each tooth. This keeps
 * a single source of truth (treatment history) instead of two records that
 * could drift apart.
 */
export async function getToothChart(db: Db, patientId: string): Promise<ToothChartEntry[]> {
  const rows = await db
    .select({
      toothNumber: treatmentRecords.toothNumber,
      condition: treatmentRecords.condition,
      id: treatmentRecords.id,
      date: treatmentRecords.date,
    })
    .from(treatmentRecords)
    .where(
      and(
        eq(treatmentRecords.patientId, patientId),
        isNotNull(treatmentRecords.toothNumber),
        isNotNull(treatmentRecords.condition),
        isNull(treatmentRecords.deletedAt),
      ),
    )
    .orderBy(desc(treatmentRecords.date), desc(treatmentRecords.createdAt));

  const latestByTooth = new Map<string, { condition: string; id: string; date: string }>();
  for (const row of rows) {
    if (!row.toothNumber || latestByTooth.has(row.toothNumber)) continue;
    latestByTooth.set(row.toothNumber, { condition: row.condition!, id: row.id, date: row.date });
  }

  return FDI_PERMANENT_TEETH.map((toothNumber) => {
    const latest = latestByTooth.get(toothNumber);
    return {
      toothNumber,
      condition: (latest?.condition ?? "healthy") as ToothChartEntry["condition"],
      lastTreatmentRecordId: latest?.id ?? null,
      lastUpdated: latest?.date ?? null,
    };
  });
}
