import type { AuctionAsset, BidRecord } from "@auction/shared";

export type CreateBidInput = {
  asset: AuctionAsset;
  bidderId: string;
  amountCents: number;
  effectiveEndAt: string;
};

export type BidsRepository = {
  createBid(input: CreateBidInput): Promise<{ bid: BidRecord; asset: AuctionAsset }>;
  countCreatedSince(since: string, input?: { principalId?: string }): Promise<number>;
  listByAsset(assetId: string): Promise<BidRecord[]>;
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
    async countCreatedSince(since, input = {}) {
      const sinceMs = new Date(since).getTime();
      const recentBids = bids.filter((bid) => new Date(bid.createdAt).getTime() >= sinceMs);
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
    async listByAsset(assetId) {
      return bids.filter((bid) => bid.assetId === assetId).map(cloneBid);
    },
    async listLatestByAssetBidders(assetId) {
      const latestByBidderId = new Map<string, BidRecord>();
      for (const bid of bids.filter((item) => item.assetId === assetId)) {
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
      return bids.filter((bid) => bid.bidderId === bidderId).map(cloneBid);
    }
  };
}
