import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = resolve(import.meta.dirname, "..");

function readAdminFile(path: string): string {
  return readFileSync(resolve(adminRoot, path), "utf8");
}

describe("admin anchor recommendation page", () => {
  it("registers anchor recommendation navigation and maintenance APIs", () => {
    const appLayout = readAdminFile("components/AppLayout.tsx");
    const app = readAdminFile("App.tsx");
    const page = readAdminFile("pages/AnchorRecommendationPage.tsx");

    expect(appLayout).toContain("主播推荐");
    expect(app).toContain("AnchorRecommendationPage");
    expect(page).toContain("adminGet<AnchorRecommendationListResponse>");
    expect(page).toContain("adminPost<AnchorRecommendationResponse>");
    expect(page).toContain("adminPut<AnchorRecommendationResponse>");
    expect(page).toContain("adminDelete<{ ok: true }>");
    expect(page).toContain("/admin/anchor-recommendations");
    expect(page).toContain("主播名称");
    expect(page).toContain("简介");
    expect(page).toContain("图片链接地址");
  });
});
