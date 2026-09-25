import { describe, expect, it } from "vitest";
import { rangesOverlap } from "../src/lib/scheduling.js";

describe("rangesOverlap", () => {
  it("detects a fully overlapping range", () => {
    expect(rangesOverlap("2026-10-01T09:00:00.000Z", "2026-10-01T10:00:00.000Z", "2026-10-01T09:15:00.000Z", "2026-10-01T09:45:00.000Z")).toBe(true);
  });

  it("detects a partial overlap at the start", () => {
    expect(rangesOverlap("2026-10-01T09:00:00.000Z", "2026-10-01T10:00:00.000Z", "2026-10-01T08:30:00.000Z", "2026-10-01T09:30:00.000Z")).toBe(true);
  });

  it("treats back-to-back slots as non-overlapping (end is exclusive)", () => {
    expect(rangesOverlap("2026-10-01T09:00:00.000Z", "2026-10-01T10:00:00.000Z", "2026-10-01T10:00:00.000Z", "2026-10-01T11:00:00.000Z")).toBe(false);
  });

  it("returns false for two clearly separate slots", () => {
    expect(rangesOverlap("2026-10-01T09:00:00.000Z", "2026-10-01T10:00:00.000Z", "2026-10-01T14:00:00.000Z", "2026-10-01T15:00:00.000Z")).toBe(false);
  });

  it("detects one range fully containing the other", () => {
    expect(rangesOverlap("2026-10-01T09:00:00.000Z", "2026-10-01T12:00:00.000Z", "2026-10-01T10:00:00.000Z", "2026-10-01T10:30:00.000Z")).toBe(true);
  });
});
