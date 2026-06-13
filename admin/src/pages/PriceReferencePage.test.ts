import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = resolve(import.meta.dirname, "..");

function readAdminFile(path: string): string {
  return readFileSync(resolve(adminRoot, path), "utf8");
}

describe("admin dragon ball price reference page", () => {
  it("adds a standalone menu page for weekly profession and quality price ranges", () => {
    const appLayout = readAdminFile("components/AppLayout.tsx");
    const app = readAdminFile("App.tsx");
    const page = readAdminFile("pages/PriceReferencePage.tsx");

    expect(appLayout).toContain("估值参考");
    expect(app).toContain("PriceReferencePage");
    expect(page).toContain("adminGet<DragonBallPriceReferenceBatchListResponse>");
    expect(page).toContain("adminPost<DragonBallPriceReferenceBatchResponse>");
    expect(page).toContain("adminPut<DragonBallPriceReferenceBatchResponse>");
    expect(page).toContain("adminDelete<DragonBallPriceReferenceBatchResponse>");
    expect(page).toContain("/admin/dragon-ball-price-reference-batches");
    expect(page).toContain("周估值参考");
    expect(page).toContain("copyBatchToCurrentWeek");
    expect(page).toContain("setSelectedBatch(null)");
    expect(page).toContain("setWeekStartDate(currentWeekStartDate())");
    expect(page).toContain("setRows(rowsFromBatch(batch))");
    expect(page).toContain("复制");
    expect(page).toContain("已复制");
    expect(page).toContain("最低价");
    expect(page).toContain("最高价");
    expect(page).toContain("dragonBallPriceReferenceProfessionOptions");
    expect(page).toContain("dragonBallQualityOptions");
    expect(page).toContain("最低价不能大于最高价");
    expect(page).not.toContain("成交价");
    expect(page).not.toContain("平均价");
  });
});
