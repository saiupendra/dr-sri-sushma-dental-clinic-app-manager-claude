/**
 * True if [aStart, aEnd) and [bStart, bEnd) overlap. Inputs are ISO 8601
 * datetime strings normalized to UTC (see appointments.ts), so ordinary
 * string comparison matches chronological order.
 */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}
