import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = resolve(import.meta.dirname, "..");

function readAdminFile(path: string): string {
  return readFileSync(resolve(adminRoot, path), "utf8");
}

describe("admin exchange resource page", () => {
  it("adds an exchange resource navigation item and paginated list page", () => {
    const appLayout = readAdminFile("components/AppLayout.tsx");
    const app = readAdminFile("App.tsx");
    const page = readAdminFile("pages/ExchangeResourcePage.tsx");

    expect(appLayout).toContain("交换资源");
    expect(app).toContain("ExchangeResourcePage");
    expect(page).toContain("adminGet<ExchangeResourceListResponse>");
    expect(page).toContain("/admin/exchange-resources");
    expect(page).toContain("全部状态");
    expect(page).toContain("发布者");
    expect(page).toContain("龙珠信息");
    expect(page).toContain("参考金额");
    expect(page).toContain("图片审核中");
    expect(page).toContain("已过期");
    expect(page).toContain("过期时间");
    expect(page).toContain("imageUrl");
    expect(page).toContain("想换什么");
  });
});
