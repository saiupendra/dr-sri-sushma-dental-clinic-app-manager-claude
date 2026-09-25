import type { InvoiceStatus } from "@clinic/shared";

/**
 * An invoice's status always follows from the money on it, so staff can
 * never leave one out of sync by forgetting a manual step. "cancelled" is
 * the one exception: it is set explicitly (see invoices.ts PATCH) and stays
 * put until the invoice itself is un-cancelled.
 */
export function deriveInvoiceStatus(
  totalAmount: number,
  amountPaid: number,
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (currentStatus === "cancelled") return "cancelled";
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid >= totalAmount) return "paid";
  return "partially_paid";
}
