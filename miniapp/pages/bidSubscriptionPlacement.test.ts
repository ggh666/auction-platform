import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const detailPagePath = resolve(import.meta.dirname, "auctions/detail.vue");

describe("bid subscription prompt placement", () => {
  it("requests price change subscription from the submit tap flow before the bid request", () => {
    const detailPage = readFileSync(detailPagePath, "utf8");
    const disclaimerIndex = detailPage.indexOf("const acceptedDisclaimer = await confirmTradingDisclaimer()");
    const bidRequestIndex = detailPage.indexOf("const response = await placeBid");
    const subscribeIndex = detailPage.indexOf("await requestBidRelatedSubscriptions({");

    expect(disclaimerIndex).toBeGreaterThanOrEqual(0);
    expect(bidRequestIndex).toBeGreaterThanOrEqual(0);
    expect(subscribeIndex).toBeGreaterThan(disclaimerIndex);
    expect(subscribeIndex).toBeLessThan(bidRequestIndex);
    expect(detailPage).toContain("[price-change-subscribe]");
    expect(detailPage).toContain("requestBidRelatedSubscriptions");
    expect(detailPage).toContain("确认出价承诺");
    expect(detailPage).toContain("commitmentAccepted: true");
  });

  it("refreshes the current detail page after a successful bid", () => {
    const detailPage = readFileSync(detailPagePath, "utf8");
    const bidRequestIndex = detailPage.indexOf("const response = await placeBid");
    const optimisticUpdateIndex = detailPage.indexOf("mergeAuctionAssetUpdate(detail.value.asset, response.asset)", bidRequestIndex);
    const refreshIndex = detailPage.indexOf("await refreshDetailAfterBid()", bidRequestIndex);

    expect(bidRequestIndex).toBeGreaterThanOrEqual(0);
    expect(optimisticUpdateIndex).toBeGreaterThan(bidRequestIndex);
    expect(refreshIndex).toBeGreaterThan(optimisticUpdateIndex);
    expect(detailPage).toContain("async function refreshDetailAfterBid()");
    expect(detailPage).toContain("loadDetail({ silent: true })");
  });
});
