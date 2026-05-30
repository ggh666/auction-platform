import { describe, expect, it } from "vitest";
import { hashAdminPassword, verifyAdminPassword } from "../../api/src/modules/admin/adminPassword";

describe("admin password hashing", () => {
  it("verifies scrypt hashes and rejects wrong passwords", async () => {
    const hash = await hashAdminPassword("correct horse battery staple");

    expect(hash.startsWith("scrypt$")).toBe(true);
    await expect(verifyAdminPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("keeps legacy plaintext dev admin passwords working for tests", async () => {
    await expect(verifyAdminPassword("reviewer-pass", "reviewer-pass")).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong", "reviewer-pass")).resolves.toBe(false);
  });
});
