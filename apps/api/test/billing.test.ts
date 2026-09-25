import { describe, expect, it } from "vitest";
import { deriveInvoiceStatus } from "../src/lib/billing.js";

describe("deriveInvoiceStatus", () => {
  it("is unpaid when nothing has been paid", () => {
    expect(deriveInvoiceStatus(1000, 0, "unpaid")).toBe("unpaid");
  });

  it("is partially_paid when some but not all has been paid", () => {
    expect(deriveInvoiceStatus(1000, 400, "unpaid")).toBe("partially_paid");
  });

  it("is paid once the full amount is covered", () => {
    expect(deriveInvoiceStatus(1000, 1000, "partially_paid")).toBe("paid");
  });

  it("is paid even if the patient overpays", () => {
    expect(deriveInvoiceStatus(1000, 1200, "partially_paid")).toBe("paid");
  });

  it("never leaves cancelled once set, regardless of payments", () => {
    expect(deriveInvoiceStatus(1000, 1000, "cancelled")).toBe("cancelled");
  });
});
