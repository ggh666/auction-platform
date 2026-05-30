export type AssetFollowRecord = {
  userId: string;
  assetId: string;
  createdAt: string;
};

export type AssetFollowListInput = {
  page?: number;
  pageSize?: number;
};

export type AssetFollowListResult = {
  items: AssetFollowRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type AssetFollowsRepository = {
  follow(userId: string, assetId: string): Promise<AssetFollowRecord>;
  unfollow(userId: string, assetId: string): Promise<void>;
  listByUser(userId: string, input?: AssetFollowListInput): Promise<AssetFollowListResult>;
  listFollowedAssetIdsIn(userId: string, assetIds: string[]): Promise<Set<string>>;
};

function normalizePage(input: AssetFollowListInput = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

function cloneFollow(record: AssetFollowRecord): AssetFollowRecord {
  return { ...record };
}

export function createInMemoryAssetFollowsRepository(): AssetFollowsRepository {
  const follows = new Map<string, AssetFollowRecord>();

  function key(userId: string, assetId: string) {
    return `${userId}:${assetId}`;
  }

  return {
    async follow(userId, assetId) {
      const followKey = key(userId, assetId);
      const existing = follows.get(followKey);
      if (existing) {
        return cloneFollow(existing);
      }

      const record: AssetFollowRecord = {
        userId,
        assetId,
        createdAt: new Date().toISOString()
      };
      follows.set(followKey, cloneFollow(record));
      return cloneFollow(record);
    },

    async unfollow(userId, assetId) {
      follows.delete(key(userId, assetId));
    },

    async listByUser(userId, input = {}) {
      const { page, pageSize } = normalizePage(input);
      const filtered = [...follows.values()]
        .filter((record) => record.userId === userId)
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
            Number(right.assetId) - Number(left.assetId)
        );
      const offset = (page - 1) * pageSize;
      return {
        items: filtered.slice(offset, offset + pageSize).map(cloneFollow),
        total: filtered.length,
        page,
        pageSize
      };
    },

    async listFollowedAssetIdsIn(userId, assetIds) {
      const uniqueAssetIds = new Set(assetIds);
      return new Set(
        [...follows.values()]
          .filter((record) => record.userId === userId && uniqueAssetIds.has(record.assetId))
          .map((record) => record.assetId)
      );
    }
  };
}
