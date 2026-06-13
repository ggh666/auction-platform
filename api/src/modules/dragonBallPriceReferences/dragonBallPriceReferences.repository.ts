import {
  dragonBallPriceReferenceProfessionOptions,
  dragonBallQualityOptions,
  type DragonBallPriceReferenceBatch,
  type DragonBallPriceReferenceItem,
  type DragonBallPriceReferenceTrendItem,
  type DragonBallPriceReferenceProfession,
  type DragonBallQuality
} from "@auction/shared";

export type DragonBallPriceReferencePageInput = {
  page?: number;
  pageSize?: number;
};

export type DragonBallPriceReferenceBatchInput = {
  gameName: string;
  weekStartDate: string;
  weekEndDate: string;
  note: string;
  items: Array<{
    profession: DragonBallPriceReferenceProfession;
    quality: DragonBallQuality;
    minPriceCents: number;
    maxPriceCents: number;
  }>;
};

export type DragonBallPriceReferenceListResult = {
  items: DragonBallPriceReferenceBatch[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type DragonBallPriceReferencesRepository = {
  listBatches(input?: DragonBallPriceReferencePageInput): Promise<DragonBallPriceReferenceListResult>;
  findBatchById(batchId: string): Promise<DragonBallPriceReferenceBatch | null>;
  upsertBatch(input: DragonBallPriceReferenceBatchInput): Promise<DragonBallPriceReferenceBatch>;
  updateBatch(batchId: string, input: DragonBallPriceReferenceBatchInput): Promise<DragonBallPriceReferenceBatch | null>;
  deleteBatch(batchId: string): Promise<DragonBallPriceReferenceBatch | null>;
  latest(gameName: string): Promise<DragonBallPriceReferenceBatch | null>;
  trend(input: {
    gameName: string;
    profession: DragonBallPriceReferenceProfession;
    quality: DragonBallQuality;
    limit?: number;
  }): Promise<DragonBallPriceReferenceTrendItem[]>;
};

function normalizePage(input: DragonBallPriceReferencePageInput = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

function cloneBatch(batch: DragonBallPriceReferenceBatch): DragonBallPriceReferenceBatch {
  return {
    ...batch,
    items: batch.items.map((item) => ({ ...item }))
  };
}

function professionOrder(profession: DragonBallPriceReferenceProfession): number {
  return dragonBallPriceReferenceProfessionOptions.indexOf(profession);
}

function qualityOrder(quality: DragonBallQuality): number {
  return dragonBallQualityOptions.indexOf(quality);
}

function sortItems(items: DragonBallPriceReferenceItem[]): DragonBallPriceReferenceItem[] {
  return [...items].sort(
    (left, right) =>
      qualityOrder(right.quality) - qualityOrder(left.quality) || professionOrder(left.profession) - professionOrder(right.profession)
  );
}

function sortBatches(items: DragonBallPriceReferenceBatch[]): DragonBallPriceReferenceBatch[] {
  return [...items].sort(
    (left, right) =>
      right.weekStartDate.localeCompare(left.weekStartDate) ||
      right.createdAt.localeCompare(left.createdAt) ||
      Number(right.id) - Number(left.id)
  );
}

function pageBatches(items: DragonBallPriceReferenceBatch[], input: DragonBallPriceReferencePageInput = {}) {
  const { page, pageSize } = normalizePage(input);
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize).map(cloneBatch),
    total: items.length,
    page,
    pageSize,
    hasMore: page * pageSize < items.length
  };
}

export function createInMemoryDragonBallPriceReferencesRepository(options: { now?: () => Date } = {}): DragonBallPriceReferencesRepository {
  const now = options.now ?? (() => new Date());
  const batches = new Map<string, DragonBallPriceReferenceBatch>();
  let nextBatchId = 1;
  let nextItemId = 1;

  function findExistingByWeek(gameName: string, weekStartDate: string): DragonBallPriceReferenceBatch | null {
    return (
      [...batches.values()].find((batch) => batch.gameName === gameName && batch.weekStartDate === weekStartDate) ?? null
    );
  }

  function createItems(batchId: string, input: DragonBallPriceReferenceBatchInput, timestamp: string): DragonBallPriceReferenceItem[] {
    const unique = new Map<string, DragonBallPriceReferenceBatchInput["items"][number]>();
    for (const item of input.items) {
      unique.set(`${item.profession}:${item.quality}`, item);
    }

    return sortItems(
      [...unique.values()].map((item) => ({
        id: String(nextItemId++),
        batchId,
        profession: item.profession,
        quality: item.quality,
        minPriceCents: item.minPriceCents,
        maxPriceCents: item.maxPriceCents,
        createdAt: timestamp,
        updatedAt: timestamp
      }))
    );
  }

  function save(batch: DragonBallPriceReferenceBatch): DragonBallPriceReferenceBatch {
    batches.set(batch.id, cloneBatch(batch));
    return cloneBatch(batch);
  }

  return {
    async listBatches(input = {}) {
      return pageBatches(sortBatches([...batches.values()]), input);
    },

    async findBatchById(batchId) {
      const batch = batches.get(batchId);
      return batch ? cloneBatch(batch) : null;
    },

    async upsertBatch(input) {
      const existing = findExistingByWeek(input.gameName, input.weekStartDate);
      const timestamp = now().toISOString();
      if (existing) {
        return save({
          ...existing,
          gameName: input.gameName,
          weekStartDate: input.weekStartDate,
          weekEndDate: input.weekEndDate,
          note: input.note,
          items: createItems(existing.id, input, timestamp),
          updatedAt: timestamp
        });
      }

      const batchId = String(nextBatchId++);
      return save({
        id: batchId,
        gameName: input.gameName,
        weekStartDate: input.weekStartDate,
        weekEndDate: input.weekEndDate,
        note: input.note,
        items: createItems(batchId, input, timestamp),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    },

    async updateBatch(batchId, input) {
      const existing = batches.get(batchId);
      if (!existing) {
        return null;
      }
      const timestamp = now().toISOString();
      return save({
        ...existing,
        gameName: input.gameName,
        weekStartDate: input.weekStartDate,
        weekEndDate: input.weekEndDate,
        note: input.note,
        items: createItems(batchId, input, timestamp),
        updatedAt: timestamp
      });
    },

    async deleteBatch(batchId) {
      const existing = batches.get(batchId);
      if (!existing) {
        return null;
      }
      batches.delete(batchId);
      return cloneBatch(existing);
    },

    async latest(gameName) {
      const batch = sortBatches([...batches.values()].filter((item) => item.gameName === gameName))[0];
      return batch ? cloneBatch(batch) : null;
    },

    async trend(input) {
      const limit = Number.isInteger(input.limit) && input.limit && input.limit > 0 ? Math.min(input.limit, 52) : 12;
      return sortBatches([...batches.values()].filter((batch) => batch.gameName === input.gameName))
        .flatMap((batch) => {
          const item = batch.items.find(
            (candidate) => candidate.profession === input.profession && candidate.quality === input.quality
          );
          return item
            ? [
                {
                  batchId: batch.id,
                  gameName: batch.gameName,
                  weekStartDate: batch.weekStartDate,
                  weekEndDate: batch.weekEndDate,
                  profession: item.profession,
                  quality: item.quality,
                  minPriceCents: item.minPriceCents,
                  maxPriceCents: item.maxPriceCents
                }
              ]
            : [];
        })
        .slice(0, limit)
        .sort((left, right) => left.weekStartDate.localeCompare(right.weekStartDate));
    }
  };
}
