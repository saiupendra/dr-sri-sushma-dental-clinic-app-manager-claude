/** Escapes one CSV field per RFC 4180: quote it if it contains a comma, quote, or newline. */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes rows into a CSV string. `columns` is required (rather than
 * inferred from the first row) so an empty table still produces a header,
 * and every row is serialized against the same fixed column order.
 */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeCsvField(row[col])).join(","));
  }
  return lines.join("\r\n");
}
