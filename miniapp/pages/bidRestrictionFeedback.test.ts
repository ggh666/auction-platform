import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const detailPagePath = resolve(import.meta.dirname, "auctions/detail.vue");

describe("miniapp bid restriction feedback", () => {
  it("shows bid restriction details in a modal instead of a toast", () => {
    const detailPage = readFileSync(detailPagePath, "utf8");

    expect(detailPage).toContain("isBidRestrictedError");
    expect(detailPage).toContain("function showBidFailure");
    expect(detailPage).toContain('title: "出价受限"');
    expect(detailPage).toContain("content: message");
    expect(detailPage).toContain("showCancel: false");
    expect(detailPage).toContain("confirmText: \"知道了\"");
    expect(detailPage).toContain("showBidFailure(error, requiredBidCentsForDetail())");
  });
});
