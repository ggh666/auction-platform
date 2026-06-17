import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = resolve(import.meta.dirname, "..");

function readAdminFile(path: string): string {
  return readFileSync(resolve(adminRoot, path), "utf8");
}

describe("admin redeem code settings page", () => {
  it("adds a config menu page for bulk redeem-code text maintenance", () => {
    const appLayout = readAdminFile("components/AppLayout.tsx");
    const app = readAdminFile("App.tsx");
    const page = readAdminFile("pages/RedeemCodeSettingsPage.tsx");

    expect(appLayout).toContain("兑换码设置");
    expect(app).toContain("RedeemCodeSettingsPage");
    expect(page).toContain("/admin/redeem-codes/config");
    expect(page).toContain("adminGet<RedeemCodeConfigResponse>");
    expect(page).toContain("adminPut<RedeemCodeConfigResponse>");
    expect(page).toContain("textarea");
    expect(page).toContain("兑换码|奖励说明|效期");
    expect(page).toContain("解析预览");
    expect(page).toContain("保存设置");
  });
});
