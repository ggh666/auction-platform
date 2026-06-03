import type { AuctionAsset, BidRecord } from "@auction/shared";

export type CreateBidInput = {
  asset: AuctionAsset;
  bidderId: string;
  amountCents: number;
  effectiveEndAt: string;
};

export type RevokeBidInput = {
  assetId: string;
  bidId: string;
  adminId: number;
  reason: string;
};

export type BidsRepository = {
  createBid(input: CreateBidInput): Promise<{ bid: BidRecord; asset: AuctionAsset }>;
  revokeBidAndRecalculate(input: RevokeBidInput): Promise<{ bid: BidRecord; asset: AuctionAsset }>;
  countCreatedSince(since: string, input?: { principalId?: string }): Promise<number>;
  listByAsset(assetId: string, input?: { includeRevoked?: boolean }): Promise<BidRecord[]>;
  listLatestByAssetBidders(assetId: string): Promise<BidRecord[]>;
  listByBidder(bidderId: string): Promise<BidRecord[]>;
};

function cloneBid(bid: BidRecord): BidRecord {
  return { ...bid };
}

export function createInMemoryBidsRepository(
  updateAsset: (asset: AuctionAsset) => Promise<AuctionAsset>,
  readAsset?: (assetId: string) => Promise<AuctionAsset | null>
): BidsRepository {
  const bids: BidRecord[] = [];
  let nextId = 1;

  return {
    async createBid(input) {
      const now = new Date().toISOString();
      const bid: BidRecord = {
        id: String(nextId),
        assetId: input.asset.id,
        bidderId: input.bidderId,
        amountCents: input.amountCents,
        revokedAt: null,
        revokedByAdminId: null,
        revokeReason: null,
        createdAt: now
      };

      // A production MySQL repository should enforce this with a transaction or conditional update.
      const asset = await updateAsset({
        ...input.asset,
        currentPriceCents: input.amountCents,
        highestBidderId: input.bidderId,
        effectiveEndAt: input.effectiveEndAt,
        updatedAt: now
      });

      nextId++;
      bids.push(cloneBid(bid));

      return { bid: cloneBid(bid), asset };
    },
    async revokeBidAndRecalculate(input) {
      const index = bids.findIndex((bid) => bid.id === input.bidId && bid.assetId === input.assetId);
      if (index === -1) {
        throw new Error("Bid not found");
      }
      if (bids[index].revokedAt) {
        throw new Error("Bid already revoked");
      }
      const revokedAt = new Date().toISOString();
      bids[index] = {
        ...bids[index],
        revokedAt,
        revokedByAdminId: String(input.adminId),
        revokeReason: input.reason.trim()
      };

      const currentAsset = readAsset ? await readAsset(input.assetId) : null;
      if (!currentAsset) {
        throw new Error("Asset not found");
      }
      const remaining = bids
        .filter((bid) => bid.assetId === input.assetId && !bid.revokedAt)
        .sort(
          (left, right) =>
            right.amountCents - left.amountCents ||
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
            Number(right.id) - Number(left.id)
        );
      const highest = remaining[0] ?? null;
      const asset = await updateAsset({
        ...currentAsset,
        currentPriceCents: highest?.amountCents ?? null,
        highestBidderId: highest?.bidderId ?? null,
        updatedAt: revokedAt
      });
      return { bid: cloneBid(bids[index]), asset };
    },
    async countCreatedSince(since, input = {}) {
      const sinceMs = new Date(since).getTime();
      const recentBids = bids.filter((bid) => !bid.revokedAt && new Date(bid.createdAt).getTime() >= sinceMs);
      if (!input.principalId) {
        return recentBids.length;
      }
      let total = 0;
      for (const bid of recentBids) {
        const asset = readAsset ? await readAsset(bid.assetId) : null;
        if (asset?.principalId === input.principalId) {
          total++;
        }
      }
      return total;
    },
    async listByAsset(assetId, input = {}) {
      return bids.filter((bid) => bid.assetId === assetId && (input.includeRevoked || !bid.revokedAt)).map(cloneBid);
    },
    async listLatestByAssetBidders(assetId) {
      const latestByBidderId = new Map<string, BidRecord>();
      for (const bid of bids.filter((item) => item.assetId === assetId && !item.revokedAt)) {
        const current = latestByBidderId.get(bid.bidderId);
        const bidTime = new Date(bid.createdAt).getTime();
        const currentTime = current ? new Date(current.createdAt).getTime() : Number.NEGATIVE_INFINITY;
        if (!current || bidTime > currentTime || (bidTime === currentTime && Number(bid.id) > Number(current.id))) {
          latestByBidderId.set(bid.bidderId, bid);
        }
      }
      return [...latestByBidderId.values()]
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || Number(left.id) - Number(right.id)
        )
        .map(cloneBid);
    },
    async listByBidder(bidderId) {
      return bids.filter((bid) => bid.bidderId === bidderId && !bid.revokedAt).map(cloneBid);
    }
  };
}
