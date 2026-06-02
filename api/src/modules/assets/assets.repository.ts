import type { AssetStatus, AuctionAsset, DragonBallInfo } from "@auction/shared";

export const defaultAdminAssetStatuses: AssetStatus[] = ["pending_review", "active"];
export const APPROVED_AUCTION_DURATION_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_ASSET_END_AT = "2099-12-31T15:59:59.000Z";

export function approvedAuctionEndAt(now = new Date()): string {
  return new Date(now.getTime() + APPROVED_AUCTION_DURATION_MS).toISOString();
}

export type CreateAssetInput = {
  sellerId: string;
  sellerGameId?: string | null;
  principalId?: string;
  gameName: string;
  serverName: string;
  assetType: string;
  itemCategory?: string | null;
  dragonBall?: DragonBallInfo | null;
  title: string;
  description: string;
  startingPriceCents: number;
  minIncrementCents: number;
  originalEndAt: string;
  images?: UploadedAssetImageInput[];
};

export type UploadedAssetImageInput = {
  objectKey: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
};

export type AdminAssetListInput = {
  keyword?: string;
  status?: AssetStatus;
  statuses?: AssetStatus[];
  gameName?: string;
  assetType?: string;
  principalId?: string;
  page?: number;
  pageSize?: number;
};

export type SoldFollowupCandidateInput = {
  principalId?: string;
  userId?: string;
  nowIso?: string;
  limit?: number;
};

export type PublicAssetListInput = {
  gameName?: string;
  assetType?: string;
  keyword?: string;
  createdSince?: string;
  nowIso?: string;
  page?: number;
  pageSize?: number;
};

export type AdminAssetListResult = {
  items: AuctionAsset[];
  total: number;
  page: number;
  pageSize: number;
};

export type PublicAssetListResult = {
  items: AuctionAsset[];
  total: number;
  page: number;
  pageSize: number;
};

export type AssetsRepository = {
  createPending(input: CreateAssetInput): Promise<AuctionAsset>;
  countCreatedBySellerSince(sellerId: string, since: string): Promise<number>;
  countCreatedSince(since: string, input?: Pick<AdminAssetListInput, "principalId">): Promise<number>;
  countByStatus(status: AssetStatus, input?: Pick<AdminAssetListInput, "principalId">): Promise<number>;
  listActive(input?: PublicAssetListInput): Promise<PublicAssetListResult>;
  listForAdmin(input?: AdminAssetListInput): Promise<AdminAssetListResult>;
  listPendingReview(input?: Pick<AdminAssetListInput, "principalId" | "page" | "pageSize">): Promise<AdminAssetListResult>;
  listBySeller(sellerId: string): Promise<AuctionAsset[]>;
  listRelatedResults(userId: string): Promise<AuctionAsset[]>;
  listSoldFollowupCandidates(input?: SoldFollowupCandidateInput): Promise<AuctionAsset[]>;
  findById(id: string, input?: Pick<AdminAssetListInput, "principalId">): Promise<AuctionAsset | null>;
  approvePending(id: string, input?: Pick<AdminAssetListInput, "principalId">): Promise<AuctionAsset>;
  rejectPending(id: string, note?: string, input?: Pick<AdminAssetListInput, "principalId">): Promise<AuctionAsset>;
  removeActive(id: string, input?: Pick<AdminAssetListInput, "principalId">): Promise<AuctionAsset>;
  confirmActiveDeal(id: string, input?: Pick<AdminAssetListInput, "principalId">): Promise<AuctionAsset>;
  updateStatus(id: string, status: AssetStatus): Promise<AuctionAsset>;
  save(asset: AuctionAsset): Promise<AuctionAsset>;
};

function isDefaultAssetEndAt(value: string): boolean {
  return new Date(value).getTime() >= new Date("2099-12-31T00:00:00.000Z").getTime();
}

export function normalizeActiveAssetEndAt(asset: AuctionAsset): AuctionAsset {
  if (asset.status !== "active" || !isDefaultAssetEndAt(asset.effectiveEndAt)) {
    return asset;
  }

  const updatedAt = new Date(asset.updatedAt);
  const createdAt = new Date(asset.createdAt);
  const approvedAt = Number.isFinite(updatedAt.getTime()) ? updatedAt : createdAt;
  if (!Number.isFinite(approvedAt.getTime())) {
    return asset;
  }

  return {
    ...asset,
    effectiveEndAt: approvedAuctionEndAt(approvedAt)
  };
}

function cloneAsset(asset: AuctionAsset): AuctionAsset {
  const normalized = normalizeActiveAssetEndAt(asset);
  return {
    ...normalized,
    imageUrls: [...normalized.imageUrls],
    dragonBall: normalized.dragonBall ? { ...normalized.dragonBall } : normalized.dragonBall
  };
}

function normalizePage(input: Pick<AdminAssetListInput, "page" | "pageSize"> = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

function matchesAdminAssetFilter(asset: AuctionAsset, input: AdminAssetListInput): boolean {
  const keyword = input.keyword?.trim().toLowerCase() ?? "";
  if (keyword) {
    const title = asset.title.toLowerCase();
    if (asset.id !== keyword && asset.sellerId !== keyword && !title.includes(keyword)) {
      return false;
    }
  }

  if (input.status && asset.status !== input.status) {
    return false;
  }
  const statuses = input.statuses ?? defaultAdminAssetStatuses;
  if (!input.status && statuses.length > 0 && !statuses.includes(asset.status)) {
    return false;
  }
  if (input.gameName?.trim() && asset.gameName !== input.gameName.trim()) {
    return false;
  }
  if (input.assetType?.trim() && asset.assetType !== input.assetType.trim()) {
    return false;
  }
  if (input.principalId && asset.principalId !== input.principalId) {
    return false;
  }
  return true;
}

function publicAssetTypesForFilter(assetType?: string): string[] {
  const normalized = assetType?.trim();
  if (!normalized) {
    return [];
  }
  return normalized === "道具" ? ["道具", "装备"] : [normalized];
}

function matchesPublicAssetFilter(asset: AuctionAsset, input: PublicAssetListInput, nowMs: number): boolean {
  if (asset.status !== "active") {
    return false;
  }
  if (new Date(asset.effectiveEndAt).getTime() <= nowMs) {
    return false;
  }
  if (input.createdSince && new Date(asset.createdAt).getTime() < new Date(input.createdSince).getTime()) {
    return false;
  }
  const gameName = input.gameName?.trim();
  if (gameName && asset.gameName !== gameName) {
    return false;
  }
  const assetTypes = publicAssetTypesForFilter(input.assetType);
  if (assetTypes.length > 0 && !assetTypes.includes(asset.assetType)) {
    return false;
  }
  const keyword = input.keyword?.trim().toLowerCase();
  if (keyword) {
    return [asset.title, asset.serverName, asset.description].some((value) => value.toLowerCase().includes(keyword));
  }
  return true;
}

export function createInMemoryAssetsRepository(): AssetsRepository {
  const assets = new Map<string, AuctionAsset>();
  let nextId = 1;

  return {
    async createPending(input) {
      const now = new Date().toISOString();
      const asset: AuctionAsset = {
        id: String(nextId++),
        sellerId: input.sellerId,
        sellerGameId: input.sellerGameId?.trim() || null,
        principalId: input.principalId ?? null,
        gameName: input.gameName,
        serverName: input.serverName,
        assetType: input.assetType,
        itemCategory: input.itemCategory ?? null,
        dragonBall: input.dragonBall ? { ...input.dragonBall } : null,
        title: input.title,
        description: input.description,
        imageUrls: [],
        status: "pending_review",
        startingPriceCents: input.startingPriceCents,
        currentPriceCents: null,
        minIncrementCents: input.minIncrementCents,
        highestBidderId: null,
        originalEndAt: input.originalEndAt,
        effectiveEndAt: input.originalEndAt,
        createdAt: now,
        updatedAt: now
      };
      asset.imageUrls = (input.images ?? []).map((image) => image.publicUrl);
      assets.set(asset.id, cloneAsset(asset));
      return cloneAsset(asset);
    },
    async countCreatedBySellerSince(sellerId, since) {
      const sinceMs = new Date(since).getTime();
      return [...assets.values()].filter(
        (asset) => asset.sellerId === sellerId && new Date(asset.createdAt).getTime() >= sinceMs
      ).length;
    },
    async countCreatedSince(since, input = {}) {
      const sinceMs = new Date(since).getTime();
      return [...assets.values()].filter(
        (asset) =>
          new Date(asset.createdAt).getTime() >= sinceMs &&
          (!input.principalId || asset.principalId === input.principalId)
      ).length;
    },
    async countByStatus(status, input = {}) {
      return [...assets.values()].filter(
        (asset) => asset.status === status && (!input.principalId || asset.principalId === input.principalId)
      ).length;
    },
    async listActive(input = {}) {
      const { page, pageSize } = normalizePage(input);
      const nowMs = input.nowIso ? new Date(input.nowIso).getTime() : Date.now();
      const filtered = [...assets.values()]
        .filter((asset) => matchesPublicAssetFilter(asset, input, nowMs))
        .sort(
          (left, right) =>
            new Date(left.effectiveEndAt).getTime() - new Date(right.effectiveEndAt).getTime() ||
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
            Number(right.id) - Number(left.id)
        );
      const offset = (page - 1) * pageSize;
      return {
        items: filtered.slice(offset, offset + pageSize).map(cloneAsset),
        total: filtered.length,
        page,
        pageSize
      };
    },
    async listForAdmin(input = {}) {
      const { page, pageSize } = normalizePage(input);
      const filtered = [...assets.values()]
        .filter((asset) => matchesAdminAssetFilter(asset, input))
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
            Number(right.id) - Number(left.id)
        );
      const offset = (page - 1) * pageSize;
      return {
        items: filtered.slice(offset, offset + pageSize).map(cloneAsset),
        total: filtered.length,
        page,
        pageSize
      };
    },
    async listPendingReview(input = {}) {
      const { page, pageSize } = normalizePage(input);
      const filtered = [...assets.values()]
        .filter((asset) => asset.status === "pending_review" && (!input.principalId || asset.principalId === input.principalId))
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() ||
            Number(left.id) - Number(right.id)
        );
      const offset = (page - 1) * pageSize;
      return {
        items: filtered.slice(offset, offset + pageSize).map(cloneAsset),
        total: filtered.length,
        page,
        pageSize
      };
    },
    async listBySeller(sellerId) {
      return [...assets.values()].filter((asset) => asset.sellerId === sellerId).map(cloneAsset);
    },
    async listRelatedResults(userId) {
      const nowMs = Date.now();
      return [...assets.values()]
        .filter((asset) => asset.highestBidderId === userId)
        .filter((asset) => asset.currentPriceCents !== null)
        .filter((asset) => asset.status === "ended" || new Date(asset.effectiveEndAt).getTime() <= nowMs)
        .map(cloneAsset);
    },
    async listSoldFollowupCandidates(input = {}) {
      const nowMs = input.nowIso ? new Date(input.nowIso).getTime() : Date.now();
      const limit = Number.isInteger(input.limit) && input.limit && input.limit > 0 ? Math.min(input.limit, 500) : 200;
      return [...assets.values()]
        .filter((asset) => asset.currentPriceCents !== null && asset.highestBidderId !== null)
        .filter((asset) => asset.status === "ended" || new Date(asset.effectiveEndAt).getTime() <= nowMs)
        .filter((asset) => !input.principalId || asset.principalId === input.principalId)
        .filter((asset) => !input.userId || asset.sellerId === input.userId || asset.highestBidderId === input.userId)
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
            Number(right.id) - Number(left.id)
        )
        .slice(0, limit)
        .map(cloneAsset);
    },
    async findById(id, input = {}) {
      const asset = assets.get(id);
      if (asset && input.principalId && asset.principalId !== input.principalId) {
        return null;
      }
      return asset ? cloneAsset(asset) : null;
    },
    async approvePending(id, input = {}) {
      const asset = assets.get(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      if (input.principalId && asset.principalId !== input.principalId) {
        throw new Error("Asset not found");
      }
      if (asset.status !== "pending_review") {
        throw new Error("Invalid asset state");
      }
      const now = new Date();
      const updated = {
        ...asset,
        status: "active" as const,
        effectiveEndAt: approvedAuctionEndAt(now),
        updatedAt: now.toISOString()
      };
      assets.set(id, cloneAsset(updated));
      return cloneAsset(updated);
    },
    async rejectPending(id, _note, input = {}) {
      const asset = assets.get(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      if (input.principalId && asset.principalId !== input.principalId) {
        throw new Error("Asset not found");
      }
      if (asset.status !== "pending_review") {
        throw new Error("Invalid asset state");
      }
      const updated = { ...asset, status: "rejected" as const, updatedAt: new Date().toISOString() };
      assets.set(id, cloneAsset(updated));
      return cloneAsset(updated);
    },
    async removeActive(id, input = {}) {
      const asset = assets.get(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      if (input.principalId && asset.principalId !== input.principalId) {
        throw new Error("Asset not found");
      }
      if (asset.status !== "active") {
        throw new Error("Invalid asset state");
      }
      const updated = { ...asset, status: "removed" as const, updatedAt: new Date().toISOString() };
      assets.set(id, cloneAsset(updated));
      return cloneAsset(updated);
    },
    async confirmActiveDeal(id, input = {}) {
      const asset = assets.get(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      if (input.principalId && asset.principalId !== input.principalId) {
        throw new Error("Asset not found");
      }
      if (asset.status !== "active") {
        throw new Error("Invalid asset state");
      }
      if (asset.currentPriceCents === null || asset.highestBidderId === null) {
        throw new Error("Invalid asset state");
      }
      const now = new Date().toISOString();
      const updated = { ...asset, status: "ended" as const, effectiveEndAt: now, updatedAt: now };
      assets.set(id, cloneAsset(updated));
      return cloneAsset(updated);
    },
    async updateStatus(id, status) {
      const asset = assets.get(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      const updated = { ...asset, status, updatedAt: new Date().toISOString() };
      assets.set(id, cloneAsset(updated));
      return cloneAsset(updated);
    },
    async save(asset) {
      const updated = { ...asset, updatedAt: new Date().toISOString() };
      assets.set(updated.id, cloneAsset(updated));
      return cloneAsset(updated);
    }
  };
}
