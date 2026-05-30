import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const detailPagePath = resolve(import.meta.dirname, "auctions/detail.vue");

describe("bid subscription prompt placement", () => {
  it("requests price change subscription only after a bid succeeds", () => {
    const detailPage = readFileSync(detailPagePath, "utf8");
    const bidRequestIndex = detailPage.indexOf("const response = await placeBid");
    const subscribeIndex = detailPage.indexOf("await requestPriceChangeSubscription()");

    expect(bidRequestIndex).toBeGreaterThanOrEqual(0);
    expect(subscribeIndex).toBeGreaterThan(bidRequestIndex);
  });
});
