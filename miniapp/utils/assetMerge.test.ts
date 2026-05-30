import type { AuctionAsset } from "@auction/shared";
import { describe, expect, it } from "vitest";
import { mergeAuctionAssetUpdate } from "./assetMerge";

const baseAsset: AuctionAsset = {
  id: "1",
  sellerId: "2",
  principalId: "3",
  principal: { id: "3", displayName: "主理人A" },
  gameName: "塔防精灵",
  serverName: "测试区",
  assetType: "账号",
  title: "测试资产",
  description: "测试描述",
  imageUrls: [],
  status: "active",
  startingPriceCents: 100,
  currentPriceCents: null,
  minIncrementCents: 100,
  highestBidderId: null,
  originalEndAt: "2026-05-29T12:00:00.000Z",
  effectiveEndAt: "2026-05-29T12:00:00.000Z",
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
  sellerViolationCount: 2,
  hasPublishedViolation: true
};

describe("miniapp auction asset update merge", () => {
  it("keeps detail-only principal and violation fields when bid updates omit them", () => {
    const { principal: _principal, sellerViolationCount: _sellerViolationCount, hasPublishedViolation: _hasPublishedViolation, ...bidAsset } = {
      ...baseAsset,
      currentPriceCents: 200,
      highestBidderId: "4"
    };

    expect(mergeAuctionAssetUpdate(baseAsset, bidAsset)).toMatchObject({
      currentPriceCents: 200,
      highestBidderId: "4",
      principal: { id: "3", displayName: "主理人A" },
      sellerViolationCount: 2,
      hasPublishedViolation: true
    });
  });

  it("uses explicit principal and violation values from the update", () => {
    expect(
      mergeAuctionAssetUpdate(baseAsset, {
        ...baseAsset,
        principal: null,
        sellerViolationCount: 0,
        hasPublishedViolation: false
      })
    ).toMatchObject({
      principal: null,
      sellerViolationCount: 0,
      hasPublishedViolation: false
    });
  });
});
