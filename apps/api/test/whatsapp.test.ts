import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, defaultReminderMessage, toWhatsAppNumber } from "../src/lib/whatsapp.js";

describe("toWhatsAppNumber", () => {
  it("prefixes a plain 10-digit Indian mobile with the country code", () => {
    expect(toWhatsAppNumber("9876543210")).toBe("919876543210");
  });

  it("strips a leading 0 before prefixing", () => {
    expect(toWhatsAppNumber("09876543210")).toBe("919876543210");
  });

  it("strips formatting characters", () => {
    expect(toWhatsAppNumber("+91 98765-43210")).toBe("919876543210");
  });

  it("leaves an already-prefixed number untouched", () => {
    expect(toWhatsAppNumber("919876543210")).toBe("919876543210");
  });
});

describe("defaultReminderMessage", () => {
  it("includes the patient's name and the clinic name", () => {
    const message = defaultReminderMessage("Asha Rao", "2026-10-05T05:30:00.000Z");
    expect(message).toContain("Asha Rao");
    expect(message).toContain("Dr.Sri Sushma");
  });
});

describe("buildWhatsAppUrl", () => {
  it("builds a wa.me link with an encoded message", () => {
    const url = buildWhatsAppUrl("9876543210", "Hi there!");
    expect(url).toBe("https://wa.me/919876543210?text=Hi%20there!");
  });
});
