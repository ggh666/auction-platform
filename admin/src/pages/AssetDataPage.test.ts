import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(import.meta.dirname, "AssetDataPage.tsx");

describe("admin principal resource page", () => {
  it("uses principal resource copy for the asset data page", () => {
    const page = readFileSync(pagePath, "utf8");

    expect(page).toContain("<h3>主理人资源</h3>");
    expect(page).toContain("加载主理人资源失败");
    expect(page).toContain("导出主理人资源失败");
    expect(page).toContain("暂无主理人资源");
    expect(page).not.toContain("<h3>资产数据</h3>");
    expect(page).not.toContain("暂无资产数据");
  });
});
