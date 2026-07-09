import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = resolve(import.meta.dirname, "..");

function readAdminFile(path: string): string {
  return readFileSync(resolve(adminRoot, path), "utf8");
}

describe("admin sky tower settings page", () => {
  it("adds a config menu page for sky tower floor maintenance", () => {
    const appLayout = readAdminFile("components/AppLayout.tsx");
    const app = readAdminFile("App.tsx");
    const page = readAdminFile("pages/SkyTowerSettingsPage.tsx");

    expect(appLayout).toContain("天空塔设置");
    expect(app).toContain("SkyTowerSettingsPage");
    expect(page).toContain("/admin/sky-tower/config");
    expect(page).toContain("adminGet<SkyTowerConfigResponse>");
    expect(page).toContain("adminPut<SkyTowerConfigResponse>");
    expect(page).toContain("textarea");
    expect(page).toContain("楼层|阵容说明|左侧战车|右侧战车|英雄位|战术备注");
    expect(page).not.toContain("前后车");
    expect(page).not.toContain('label: "前车"');
    expect(page).not.toContain('label: "后车"');
    expect(page).toContain("解析预览");
    expect(page).toContain("保存设置");
    expect(page).toContain("DataTable");
  });
});
