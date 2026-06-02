import type { AuctionAsset } from "@auction/shared";

export function toPublicAsset(asset: AuctionAsset): AuctionAsset {
  const publicAsset = { ...asset };
  delete publicAsset.sellerGameId;
  return publicAsset;
}
