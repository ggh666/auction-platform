import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const assetDetailPath = resolve(import.meta.dirname, "AssetDetailPage.tsx");
const userManagementPath = resolve(import.meta.dirname, "UserManagementPage.tsx");

describe("admin risk control UI", () => {
  it("shows bid revoke and restriction controls on the asset detail bid table", () => {
    const page = readFileSync(assetDetailPath, "utf8");

    expect(page).toContain("撤销并限制");
    expect(page).toContain("revoke-and-restrict");
    expect(page).toContain("30分钟");
    expect(page).toContain("1天");
    expect(page).toContain("永久");
    expect(page).toContain("解除出价限制");
  });

  it("allows super admins to release bid restrictions from user management", () => {
    const page = readFileSync(userManagementPath, "utf8");

    expect(page).toContain("解除出价限制");
    expect(page).toContain("bid-restriction/release");
    expect(page).toContain("永久限制");
  });
});
