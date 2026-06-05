import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const detailPagePath = resolve(import.meta.dirname, "auctions/detail.vue");

describe("auction detail realtime refresh", () => {
  it("keeps websocket realtime as the primary update path with reconnect fallback", () => {
    const detailPage = readFileSync(detailPagePath, "utf8");

    expect(detailPage).toContain("const realtimeReconnectDelaysMs = [3000, 5000, 10000, 20000] as const;");
    expect(detailPage).toContain("const realtimeFallbackRefreshIntervalMs = 20000;");
    expect(detailPage).toContain("const realtimeFallbackAfterFailures = 2;");
    expect(detailPage).toContain("function scheduleAuctionRealtimeReconnect()");
    expect(detailPage).toContain("function startRealtimeFallbackRefresh()");
    expect(detailPage).toContain("function stopRealtimeFallbackRefresh()");
    expect(detailPage).toContain("function clearRealtimeReconnectTimer()");
    expect(detailPage).toContain("setTimeout(() => {");
    expect(detailPage).toContain("setInterval(() => {");
    expect(detailPage).toContain("void loadDetail({ silent: true });");
  });

  it("cleans timers on unload and stops fallback refresh when websocket recovers", () => {
    const detailPage = readFileSync(detailPagePath, "utf8");

    expect(detailPage).toContain("closeAuctionRealtime();");
    expect(detailPage).toContain("clearRealtimeReconnectTimer();");
    expect(detailPage).toContain("stopRealtimeFallbackRefresh();");
    expect(detailPage).toContain("function handleAuctionRealtimeOpen()");
    expect(detailPage).toContain("realtimeReconnectAttempts = 0;");
    expect(detailPage).toContain("onOpen() {");
    expect(detailPage).toContain("onClose() {");
    expect(detailPage).toContain("onError() {");
  });

  it("applies accepted bid events to price, recent bids, and the next bid amount", () => {
    const detailPage = readFileSync(detailPagePath, "utf8");

    expect(detailPage).toContain('event.type === "bid_accepted"');
    expect(detailPage).toContain("asset: mergeAuctionAssetUpdate(detail.value.asset, event.asset)");
    expect(detailPage).toContain("prependRecentBid(event.bid);");
    expect(detailPage).toContain("bidAmountYuan.value = formatPrice(requiredBidCentsForDetail());");
    expect(detailPage).toContain("event.bid.bidder.displayName");
  });
});
