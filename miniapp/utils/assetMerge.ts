import type { AuctionAsset } from "@auction/shared";

export function mergeAuctionAssetUpdate(current: AuctionAsset, update: AuctionAsset): AuctionAsset {
  return {
    ...update,
    principal: update.principal === undefined ? current.principal : update.principal,
    sellerViolationCount: update.sellerViolationCount === undefined ? current.sellerViolationCount : update.sellerViolationCount,
    hasPublishedViolation: update.hasPublishedViolation === undefined ? current.hasPublishedViolation : update.hasPublishedViolation
  };
}
