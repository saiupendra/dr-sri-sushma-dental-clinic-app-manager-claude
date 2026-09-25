import { describe, expect, it } from "vitest";
import { SESSION_IDLE_TIMEOUT_SECONDS, isSessionExpired, isSessionIdle } from "../src/lib/session.js";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const IDLE_MS = SESSION_IDLE_TIMEOUT_SECONDS * 1000;

describe("isSessionExpired", () => {
  it("is not expired before its expiresAt", () => {
    expect(isSessionExpired(new Date(NOW + 1000).toISOString(), NOW)).toBe(false);
  });

  it("is not expired exactly at its expiresAt", () => {
    expect(isSessionExpired(new Date(NOW).toISOString(), NOW)).toBe(false);
  });

  it("is expired once past its expiresAt", () => {
    expect(isSessionExpired(new Date(NOW - 1000).toISOString(), NOW)).toBe(true);
  });
});

describe("isSessionIdle", () => {
  it("is not idle right after activity", () => {
    expect(isSessionIdle(new Date(NOW).toISOString(), NOW)).toBe(false);
  });

  it("is not idle just under the timeout", () => {
    expect(isSessionIdle(new Date(NOW - IDLE_MS + 1000).toISOString(), NOW)).toBe(false);
  });

  it("is idle once past the timeout", () => {
    expect(isSessionIdle(new Date(NOW - IDLE_MS - 1000).toISOString(), NOW)).toBe(true);
  });
});
