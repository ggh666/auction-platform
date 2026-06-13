import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import pagesConfig from "../pages.json";

const miniappRoot = resolve(import.meta.dirname, "..");

function readMiniappFile(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp dragon ball price reference", () => {
  it("adds a pricing reference page and entries from mode and publish pages", () => {
    const paths = pagesConfig.pages.map((page) => page.path);
    const modePage = readMiniappFile("pages/games/mode.vue");
    const publishPage = readMiniappFile("pages/exchange/publish.vue");
    const referencePage = readMiniappFile("pages/priceReference/index.vue");
    const client = readMiniappFile("api/client.ts");

    expect(paths).toContain("pages/priceReference/index");
    expect(paths).not.toContain("pages/price-reference/index");
    expect(modePage).toContain("估值参考");
    expect(modePage).toContain("/pages/priceReference/index");
    expect(modePage).not.toContain("/pages/price-reference/index");
    expect(publishPage).toContain("/pages/priceReference/index");
    expect(publishPage).not.toContain("/pages/price-reference/index");
    expect(publishPage).toContain("getDragonBallPriceReferenceLatest");
    expect(publishPage).toContain("合理填写参考金额，能更快找到新主人");
    expect(publishPage).toContain("估值参考");
    expect(publishPage).toContain("referenceRangeText");
    expect(referencePage).toContain("getDragonBallPriceReferenceLatest");
    expect(referencePage).toContain("getDragonBallPriceReferenceTrend");
    expect(referencePage).toContain("uni.showShareMenu");
    expect(referencePage).toContain("onShareAppMessage");
    expect(referencePage).toContain("onShareTimeline");
    expect(referencePage).toContain("buildPriceReferenceShare");
    expect(referencePage).toContain("dragonBallPriceReferenceProfessionOptions");
    expect(referencePage).toContain("dragonBallQualityOptions");
    expect(referencePage).toContain("最低价");
    expect(referencePage).toContain("最高价");
    expect(referencePage).toContain("趋势");
    expect(referencePage).toContain("normalizePriceReferenceBatch");
    expect(referencePage).toContain("normalizePriceReferenceTrendItems");
    expect(referencePage).toContain("latestItems");
    expect(referencePage).toContain("trendRows");
    expect(referencePage).toContain("barStyle");
    expect(referencePage).toContain(':style="item.barStyle"');
    expect(referencePage).not.toContain("latestBatch.items.length");
    expect(referencePage).not.toContain("latestBatch.items");
    expect(referencePage).not.toContain("trendItems.value = response.items");
    expect(referencePage).not.toContain("centsToYuanText(value)");
    expect(referencePage).not.toContain(':style="{ width: trendBarWidth(item.maxPriceCents) }"');
    expect(referencePage).not.toContain("trendBarWidth(item.maxPriceCents)");
    expect(referencePage).not.toContain("成交价");
    expect(referencePage).not.toContain("平均价");
    expect(client).toContain("getDragonBallPriceReferenceLatest");
    expect(client).toContain("getDragonBallPriceReferenceTrend");
  });
});
