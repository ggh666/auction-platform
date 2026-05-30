import { canBidAmount, shouldExtendAuction } from "@auction/shared";
import { badRequest, forbidden, notFound } from "../../http/errors";
import type { AssetsRepository } from "../assets/assets.repository";
import type { BidsRepository } from "./bids.repository";

export function createBidsService(input: {
  assets: AssetsRepository;
  bids: BidsRepository;
  extensionWindowSeconds: number;
  extensionDurationSeconds: number;
}) {
  return {
    async placeBid(userId: string, assetId: string, amountCents: number) {
      const asset = await input.assets.findById(assetId);
      if (!asset) {
        throw notFound("asset_not_found", "Asset not found");
      }
      if (asset.status !== "active") {
        throw badRequest("asset_not_active", "Asset is not active");
      }
      if (asset.sellerId === userId) {
        throw forbidden("seller_cannot_bid", "Seller cannot bid on own asset");
      }

      const now = new Date();
      const end = new Date(asset.effectiveEndAt);
      if (!Number.isFinite(end.getTime()) || now.getTime() >= end.getTime()) {
        throw badRequest("auction_ended", "Auction already ended");
      }

      if (
        !canBidAmount({
          amountCents,
          startingPriceCents: asset.startingPriceCents,
          currentPriceCents: asset.currentPriceCents,
          minIncrementCents: asset.minIncrementCents
        })
      ) {
        throw badRequest("bid_too_low", "Bid does not satisfy current price and increment");
      }

      const extended = shouldExtendAuction({
        bidAt: now,
        effectiveEndAt: end,
        extensionWindowSeconds: input.extensionWindowSeconds
      });
      const effectiveEndAt = extended
        ? new Date(end.getTime() + input.extensionDurationSeconds * 1000).toISOString()
        : asset.effectiveEndAt;

      return {
        ...(await input.bids.createBid({ asset, bidderId: userId, amountCents, effectiveEndAt })),
        extended
      };
    }
  };
}
