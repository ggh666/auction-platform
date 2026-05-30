import type { AuctionAsset } from "@auction/shared";
import { describe, expect, it } from "vitest";
import { createSettlementService } from "../../api/src/modules/settlement/settlement.service";

function asset(overrides: Partial<AuctionAsset> = {}): AuctionAsset {
  const now = new Date().toISOString();
  return {
    id: "asset-1",
    sellerId: "seller-1",
    gameName: "梦幻西游",
    serverName: "测试区",
    assetType: "角色",
    title: "69级角色",
    description: "展示用资产",
    imageUrls: [],
    status: "ended",
    startingPriceCents: 10000,
    currentPriceCents: null,
    minIncrementCents: 100,
    highestBidderId: null,
    originalEndAt: now,
    effectiveEndAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("settlement service", () => {
  it("settles an asset with a highest bidder as sold", () => {
    const service = createSettlementService();

    const result = service.settleAsset(
      asset({
        currentPriceCents: 16000,
        highestBidderId: "buyer-1"
      })
    );

    expect(result).toMatchObject({
      assetId: "asset-1",
      sellerId: "seller-1",
      buyerId: "buyer-1",
      status: "sold",
      finalPriceCents: 16000
    });
    expect(result.settledAt).toEqual(expect.any(String));
  });

  it("settles an asset without a highest bidder as unsold", () => {
    const service = createSettlementService();

    const result = service.settleAsset(asset());

    expect(result).toMatchObject({
      assetId: "asset-1",
      sellerId: "seller-1",
      buyerId: null,
      status: "unsold",
      finalPriceCents: null
    });
  });
});
