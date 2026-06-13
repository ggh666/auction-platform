import type { DragonBallInfo, ExchangeResource, ExchangeResourceStatus, UserSummary } from "@auction/shared";

export type ExchangeResourcePageInput = {
  page?: number;
  pageSize?: number;
};

export type ExchangeResourceListInput = ExchangeResourcePageInput & {
  gameName?: string;
  dragonBallProfession?: string;
  dragonBallQuality?: string;
  keyword?: string;
};

export type ExchangeResourceAdminListInput = ExchangeResourceListInput & {
  status?: ExchangeResourceStatus;
};

export type ExchangeResourceListResult = {
  items: ExchangeResource[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type CreateExchangeResourceInput = {
  publisher: UserSummary;
  gameName: string;
  serverName: string;
  title: string;
  dragonBall: DragonBallInfo;
  dragonBallAmountCents: number | null;
  image: {
    objectKey: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
  };
  desiredExchange: string;
  description: string;
  status: Extract<ExchangeResourceStatus, "pending_image_review" | "active">;
  expiresAt?: string;
};

export type ExchangeResourcesRepository = {
  create(input: CreateExchangeResourceInput): Promise<ExchangeResource>;
  listActive(input?: ExchangeResourceListInput): Promise<ExchangeResourceListResult>;
  listForAdmin(input?: ExchangeResourceAdminListInput): Promise<ExchangeResourceListResult>;
  listByPublisher(publisherId: string, input?: ExchangeResourcePageInput): Promise<ExchangeResourceListResult>;
  listPendingImageReview(): Promise<ExchangeResource[]>;
  findById(id: string): Promise<ExchangeResource | null>;
  activateImageReviewed(id: string): Promise<void>;
  expireDue(): Promise<void>;
  closeByPublisher(id: string, publisherId: string): Promise<ExchangeResource | null>;
};

function normalizePage(input: ExchangeResourcePageInput = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

function pageItems<T>(items: T[], input: ExchangeResourcePageInput = {}) {
  const { page, pageSize } = normalizePage(input);
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    total: items.length,
    page,
    pageSize,
    hasMore: page * pageSize < items.length
  };
}

function cloneResource(resource: ExchangeResource): ExchangeResource {
  return {
    ...resource,
    publisher: resource.publisher ? { ...resource.publisher } : undefined,
    dragonBall: { ...resource.dragonBall }
  };
}

function sortResources(items: ExchangeResource[]): ExchangeResource[] {
  return [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || Number(right.id) - Number(left.id)
  );
}

function matchesActiveFilter(resource: ExchangeResource, input: ExchangeResourceListInput = {}) {
  if (resource.status !== "active") {
    return false;
  }
  return matchesResourceFilter(resource, input);
}

function matchesResourceFilter(resource: ExchangeResource, input: ExchangeResourceListInput = {}) {
  const gameName = input.gameName?.trim();
  if (gameName && resource.gameName !== gameName) {
    return false;
  }
  if (input.dragonBallProfession?.trim() && resource.dragonBall.profession !== input.dragonBallProfession.trim()) {
    return false;
  }
  if (input.dragonBallQuality?.trim() && resource.dragonBall.quality !== input.dragonBallQuality.trim()) {
    return false;
  }
  const keyword = input.keyword?.trim().toLowerCase();
  if (keyword) {
    return [
      resource.title,
      resource.serverName,
      resource.desiredExchange,
      resource.description,
      resource.dragonBallAmountCents === null ? "" : String(resource.dragonBallAmountCents),
      resource.publisher?.displayName ?? "",
      resource.publisherId
    ].some((value) => value.toLowerCase().includes(keyword));
  }
  return true;
}

function matchesAdminFilter(resource: ExchangeResource, input: ExchangeResourceAdminListInput = {}) {
  if (input.status && resource.status !== input.status) {
    return false;
  }
  return matchesResourceFilter(resource, input);
}

export function createInMemoryExchangeResourcesRepository(options: { now?: () => Date } = {}): ExchangeResourcesRepository {
  const now = options.now ?? (() => new Date());
  const resources = new Map<string, ExchangeResource>();
  let nextId = 1;

  function expiresAtFor(timestamp: Date): string {
    return new Date(timestamp.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  function save(resource: ExchangeResource): ExchangeResource {
    resources.set(resource.id, cloneResource(resource));
    return cloneResource(resource);
  }

  return {
    async create(input) {
      const createdAt = now();
      const timestamp = createdAt.toISOString();
      return save({
        id: String(nextId++),
        publisherId: input.publisher.id,
        publisher: { ...input.publisher },
        gameName: input.gameName,
        serverName: input.serverName,
        assetType: "道具",
        itemCategory: "龙珠",
        dragonBall: { ...input.dragonBall },
        dragonBallAmountCents: input.dragonBallAmountCents,
        title: input.title,
        imageObjectKey: input.image.objectKey,
        imageUrl: input.image.publicUrl,
        imageMimeType: input.image.mimeType,
        imageSizeBytes: input.image.sizeBytes,
        desiredExchange: input.desiredExchange,
        description: input.description,
        status: input.status,
        expiresAt: input.expiresAt || expiresAtFor(createdAt),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    },

    async listActive(input = {}) {
      const filtered = sortResources([...resources.values()].filter((resource) => matchesActiveFilter(resource, input)));
      return pageItems(filtered.map(cloneResource), input);
    },

    async listForAdmin(input = {}) {
      const filtered = sortResources([...resources.values()].filter((resource) => matchesAdminFilter(resource, input)));
      return pageItems(filtered.map(cloneResource), input);
    },

    async listByPublisher(publisherId, input = {}) {
      const filtered = sortResources([...resources.values()].filter((resource) => resource.publisherId === publisherId));
      return pageItems(filtered.map(cloneResource), input);
    },

    async listPendingImageReview() {
      return sortResources([...resources.values()].filter((resource) => resource.status === "pending_image_review")).map(cloneResource);
    },

    async findById(id) {
      const resource = resources.get(id);
      return resource ? cloneResource(resource) : null;
    },

    async activateImageReviewed(id) {
      const resource = resources.get(id);
      if (!resource || resource.status !== "pending_image_review") {
        return;
      }
      save({
        ...resource,
        status: "active",
        updatedAt: now().toISOString()
      });
    },

    async expireDue() {
      const currentTimeMs = now().getTime();
      for (const resource of resources.values()) {
        if (
          (resource.status === "active" || resource.status === "pending_image_review") &&
          new Date(resource.expiresAt).getTime() <= currentTimeMs
        ) {
          save({
            ...resource,
            status: "expired",
            updatedAt: now().toISOString()
          });
        }
      }
    },

    async closeByPublisher(id, publisherId) {
      const resource = resources.get(id);
      if (!resource || resource.publisherId !== publisherId) {
        return null;
      }
      const status: ExchangeResourceStatus =
        resource.status === "removed" || resource.status === "expired" ? resource.status : "closed";
      return save({
        ...resource,
        status,
        updatedAt: now().toISOString()
      });
    }
  };
}
