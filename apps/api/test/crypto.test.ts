import { describe, expect, it } from "vitest";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "../src/lib/crypto.js";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const { hash, salt } = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash, salt)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const { hash, salt } = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash, salt)).resolves.toBe(false);
  });

  it("produces a different hash and salt each time (even for the same password)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("randomToken", () => {
  it("returns hex strings of the requested byte length and never repeats", () => {
    const a = randomToken(32);
    const b = randomToken(32);
    expect(a).toHaveLength(64);
    expect(a).toMatch(/^[0-9a-f]+$/);
    expect(a).not.toBe(b);
  });
});

describe("sha256Hex", () => {
  it("is deterministic for the same input", async () => {
    await expect(sha256Hex("hello")).resolves.toBe(await sha256Hex("hello"));
  });

  it("differs for different input", async () => {
    await expect(sha256Hex("hello")).resolves.not.toBe(await sha256Hex("hello!"));
  });
});
