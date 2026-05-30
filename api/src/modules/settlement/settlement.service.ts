import type { AuctionAsset, AuctionResultStatus } from "@auction/shared";

export type AuctionSettlementResult = {
  assetId: string;
  sellerId: string;
  buyerId: string | null;
  status: AuctionResultStatus;
  finalPriceCents: number | null;
  settledAt: string;
};

export function createSettlementService() {
  return {
    settleAsset(asset: AuctionAsset): AuctionSettlementResult {
      if (asset.highestBidderId && asset.currentPriceCents !== null) {
        return {
          assetId: asset.id,
          sellerId: asset.sellerId,
          buyerId: asset.highestBidderId,
          status: "sold",
          finalPriceCents: asset.currentPriceCents,
          settledAt: new Date().toISOString()
        };
      }

      return {
        assetId: asset.id,
        sellerId: asset.sellerId,
        buyerId: null,
        status: "unsold",
        finalPriceCents: null,
        settledAt: new Date().toISOString()
      };
    }
  };
}
