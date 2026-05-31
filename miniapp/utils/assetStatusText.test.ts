import { describe, expect, it } from "vitest";
import { assetStatusText, isSoldAsset } from "./assetStatusText";

describe("miniapp asset status text", () => {
  it("maps asset review and lifecycle statuses to Chinese labels", () => {
    expect(assetStatusText("draft")).toBe("草稿");
    expect(assetStatusText("pending_review")).toBe("审核中");
    expect(assetStatusText("active")).toBe("已上架");
    expect(assetStatusText("ended")).toBe("已结束");
    expect(assetStatusText("rejected")).toBe("已驳回");
    expect(assetStatusText("cancelled")).toBe("已取消");
    expect(assetStatusText("removed")).toBe("已下架");
  });

  it("shows ended assets with a highest bidder as sold", () => {
    const soldAsset = { status: "ended" as const, currentPriceCents: 12000, highestBidderId: "2" };
    const unsoldAsset = { status: "ended" as const, currentPriceCents: null, highestBidderId: null };

    expect(isSoldAsset(soldAsset)).toBe(true);
    expect(assetStatusText(soldAsset)).toBe("已成交");
    expect(isSoldAsset(unsoldAsset)).toBe(false);
    expect(assetStatusText(unsoldAsset)).toBe("已结束");
  });
});
