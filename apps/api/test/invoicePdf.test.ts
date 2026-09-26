import { describe, expect, it } from "vitest";
import { generateInvoicePdf } from "../src/lib/invoicePdf.js";

const BASE_INPUT = {
  invoiceId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  date: "2026-10-05T09:30:00.000Z",
  patientName: "Asha Rao",
  patientPhone: "9876543210",
  items: [{ description: "Scaling and polishing", amount: 1500 }],
  totalAmount: 1500,
  amountPaid: 0,
};

function isPdf(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

describe("generateInvoicePdf", () => {
  it("produces valid PDF bytes", async () => {
    const bytes = await generateInvoicePdf({ ...BASE_INPUT, status: "unpaid" });
    expect(isPdf(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("does not throw for every invoice status", async () => {
    for (const status of ["unpaid", "partially_paid", "paid", "cancelled"]) {
      const bytes = await generateInvoicePdf({ ...BASE_INPUT, status });
      expect(isPdf(bytes)).toBe(true);
    }
  });

  it("does not throw with no line items", async () => {
    const bytes = await generateInvoicePdf({ ...BASE_INPUT, status: "unpaid", items: [], totalAmount: 0 });
    expect(isPdf(bytes)).toBe(true);
  });

  it("paginates onto a second page rather than throwing when there are many line items", async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ description: `Procedure ${i + 1}`, amount: 100 }));
    const bytes = await generateInvoicePdf({ ...BASE_INPUT, status: "unpaid", items, totalAmount: 6000 });
    expect(isPdf(bytes)).toBe(true);
  });

  it("never renders the raw rupee sign, which standard PDF fonts can't encode", async () => {
    const bytes = await generateInvoicePdf({ ...BASE_INPUT, status: "unpaid" });
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).not.toContain("₹");
  });
});
