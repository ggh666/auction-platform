import type { AuctionAsset, DealFollowupStatus } from "@auction/shared";

export type DealFollowupRecord = {
  id: string;
  assetId: string;
  principalId: string | null;
  sellerId: string;
  buyerId: string;
  finalPriceCents: number;
  status: DealFollowupStatus;
  note: string | null;
  buyerConfirmedAt: string | null;
  buyerAbandonedAt: string | null;
  principalContactedAt: string | null;
  buyerUnreachableAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DealFollowupListInput = {
  principalId?: string;
  buyerId?: string;
  status?: DealFollowupStatus;
  page?: number;
  pageSize?: number;
};

export type DealFollowupListResult = {
  items: DealFollowupRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminDealFollowupStatus = Extract<
  DealFollowupStatus,
  "principal_contacted" | "buyer_unreachable" | "completed" | "cancelled"
>;

export type DealFollowupsRepository = {
  ensureForSoldAsset(asset: AuctionAsset): Promise<DealFollowupRecord | null>;
  ensureForSoldAssets(assets: AuctionAsset[]): Promise<DealFollowupRecord[]>;
  findById(id: string): Promise<DealFollowupRecord | null>;
  listForBuyer(userId: string, input?: Pick<DealFollowupListInput, "status" | "page" | "pageSize">): Promise<DealFollowupListResult>;
  listForAdmin(input?: Pick<DealFollowupListInput, "principalId" | "status" | "page" | "pageSize">): Promise<DealFollowupListResult>;
  updateBuyerStatus(id: string, buyerId: string, status: Extract<DealFollowupStatus, "buyer_confirmed" | "buyer_abandoned">): Promise<DealFollowupRecord | null>;
  updateAdminStatus(id: string, status: AdminDealFollowupStatus, note: string | null): Promise<DealFollowupRecord | null>;
};

export type InMemoryDealFollowupsRepository = DealFollowupsRepository & {
  setNow(now: () => Date): void;
};

export function isSoldFollowupAsset(asset: AuctionAsset, now = new Date()): boolean {
  return (
    asset.currentPriceCents !== null &&
    asset.highestBidderId !== null &&
    (asset.status === "ended" || new Date(asset.effectiveEndAt).getTime() <= now.getTime())
  );
}

function normalizePage(input: Pick<DealFollowupListInput, "page" | "pageSize"> = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

function cloneFollowup(followup: DealFollowupRecord): DealFollowupRecord {
  return { ...followup };
}

function sortFollowups(left: DealFollowupRecord, right: DealFollowupRecord): number {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
    Number(right.id) - Number(left.id)
  );
}

function applyStatusTimestamp(
  followup: DealFollowupRecord,
  status: DealFollowupStatus,
  timestamp: string
): DealFollowupRecord {
  return {
    ...followup,
    status,
    buyerConfirmedAt: status === "buyer_confirmed" ? timestamp : followup.buyerConfirmedAt,
    buyerAbandonedAt: status === "buyer_abandoned" ? timestamp : followup.buyerAbandonedAt,
    principalContactedAt: status === "principal_contacted" ? timestamp : followup.principalContactedAt,
    buyerUnreachableAt: status === "buyer_unreachable" ? timestamp : followup.buyerUnreachableAt,
    completedAt: status === "completed" ? timestamp : followup.completedAt,
    cancelledAt: status === "cancelled" ? timestamp : followup.cancelledAt,
    updatedAt: timestamp
  };
}

export function createInMemoryDealFollowupsRepository(options: { now?: () => Date } = {}): InMemoryDealFollowupsRepository {
  const followups = new Map<string, DealFollowupRecord>();
  const assetIdToFollowupId = new Map<string, string>();
  let nextId = 1;
  let now = options.now ?? (() => new Date());

  function createFromAsset(asset: AuctionAsset): DealFollowupRecord | null {
    if (!isSoldFollowupAsset(asset, now())) {
      return null;
    }
    const existingId = assetIdToFollowupId.get(asset.id);
    const timestamp = now().toISOString();
    if (existingId) {
      const existing = followups.get(existingId);
      if (!existing) {
        return null;
      }
      const updated: DealFollowupRecord = {
        ...existing,
        principalId: asset.principalId,
        sellerId: asset.sellerId,
        buyerId: asset.highestBidderId as string,
        finalPriceCents: asset.currentPriceCents as number,
        updatedAt: timestamp
      };
      followups.set(existingId, updated);
      return cloneFollowup(updated);
    }

    const followup: DealFollowupRecord = {
      id: String(nextId++),
      assetId: asset.id,
      principalId: asset.principalId,
      sellerId: asset.sellerId,
      buyerId: asset.highestBidderId as string,
      finalPriceCents: asset.currentPriceCents as number,
      status: "pending_buyer_confirm",
      note: null,
      buyerConfirmedAt: null,
      buyerAbandonedAt: null,
      principalContactedAt: null,
      buyerUnreachableAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    followups.set(followup.id, followup);
    assetIdToFollowupId.set(asset.id, followup.id);
    return cloneFollowup(followup);
  }

  function list(input: DealFollowupListInput = {}): DealFollowupListResult {
    const { page, pageSize } = normalizePage(input);
    const filtered = [...followups.values()]
      .filter((followup) => !input.principalId || followup.principalId === input.principalId)
      .filter((followup) => !input.buyerId || followup.buyerId === input.buyerId)
      .filter((followup) => !input.status || followup.status === input.status)
      .sort(sortFollowups);
    const offset = (page - 1) * pageSize;
    return {
      items: filtered.slice(offset, offset + pageSize).map(cloneFollowup),
      total: filtered.length,
      page,
      pageSize
    };
  }

  return {
    setNow(nextNow) {
      now = nextNow;
    },
    async ensureForSoldAsset(asset) {
      return createFromAsset(asset);
    },
    async ensureForSoldAssets(assets) {
      const items: DealFollowupRecord[] = [];
      for (const asset of assets) {
        const followup = createFromAsset(asset);
        if (followup) {
          items.push(followup);
        }
      }
      return items;
    },
    async findById(id) {
      const followup = followups.get(id);
      return followup ? cloneFollowup(followup) : null;
    },
    async listForBuyer(userId, input = {}) {
      return list({ ...input, buyerId: userId });
    },
    async listForAdmin(input = {}) {
      return list(input);
    },
    async updateBuyerStatus(id, buyerId, status) {
      const followup = followups.get(id);
      if (!followup || followup.buyerId !== buyerId) {
        return null;
      }
      const updated = applyStatusTimestamp(followup, status, now().toISOString());
      followups.set(id, updated);
      return cloneFollowup(updated);
    },
    async updateAdminStatus(id, status, note) {
      const followup = followups.get(id);
      if (!followup) {
        return null;
      }
      const timestamp = now().toISOString();
      const updated = applyStatusTimestamp({ ...followup, note }, status, timestamp);
      followups.set(id, updated);
      return cloneFollowup(updated);
    }
  };
}
