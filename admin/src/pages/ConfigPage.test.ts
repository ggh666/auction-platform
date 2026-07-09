import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = resolve(import.meta.dirname, "..");

function readAdminFile(path: string): string {
  return readFileSync(resolve(adminRoot, path), "utf8");
}

describe("admin config page", () => {
  it("labels the miniapp check-in URL system config", () => {
    const page = readAdminFile("pages/ConfigPage.tsx");

    expect(page).toContain("check_in_url");
    expect(page).toContain("签到链接");
    expect(page).toContain("小程序攻略页签到入口");
    expect(page).toContain("dungeon_material_image_url");
    expect(page).toContain("活动材料");
    expect(page).toContain("活动材料页展示的图片地址");
    expect(page).toContain("dungeon_guide_image_url");
    expect(page).toContain("活动攻略");
    expect(page).toContain("多个图片链接可用换行、逗号或分号分隔");
  });
});
