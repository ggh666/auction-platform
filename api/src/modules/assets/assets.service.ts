import { isDragonBallProfession, isDragonBallQuality, dragonBallElementForProfession, isWholeYuanCents } from "@auction/shared";
import { badRequest, notFound } from "../../http/errors";
import { DEFAULT_ASSET_END_AT, type AssetsRepository, type CreateAssetInput, type PublicAssetListInput, type UploadedAssetImageInput } from "./assets.repository";

type CreateAssetDraftInput = Omit<CreateAssetInput, "originalEndAt" | "itemCategory" | "dragonBall"> & {
  originalEndAt?: string;
  itemCategory?: unknown;
  dragonBall?: unknown;
};

type CreateActiveAssetInput = Omit<CreateAssetDraftInput, "originalEndAt"> & {
  endAt: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isPositiveWholeYuanCents(value: unknown): value is number {
  return isWholeYuanCents(value) && value > 0;
}

function sanitizeImages(value: CreateAssetInput["images"]): UploadedAssetImageInput[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 9) {
    throw badRequest("invalid_asset_images", "Asset images are invalid");
  }

  return value.map((image) => {
    if (
      typeof image.objectKey !== "string" ||
      typeof image.publicUrl !== "string" ||
      typeof image.mimeType !== "string" ||
      !isPositiveSafeInteger(image.sizeBytes)
    ) {
      throw badRequest("invalid_asset_images", "Asset images are invalid");
    }
    return {
      objectKey: image.objectKey.trim(),
      publicUrl: image.publicUrl.trim(),
      mimeType: image.mimeType.trim(),
      sizeBytes: image.sizeBytes
    };
  });
}

function normalizeDragonBallInput(assetType: string, itemCategory: unknown, dragonBall: unknown) {
  const category = typeof itemCategory === "string" ? itemCategory.trim() : "";
  const hasDragonBallPayload = dragonBall !== undefined && dragonBall !== null;
  if (!category && !hasDragonBallPayload) {
    return { itemCategory: null, dragonBall: null };
  }

  if (category && category !== "龙珠") {
    throw badRequest("invalid_dragon_ball", "Dragon ball metadata is invalid");
  }
  if (assetType !== "道具" && assetType !== "装备") {
    throw badRequest("invalid_dragon_ball", "Dragon ball metadata is only supported for prop assets");
  }
  if (typeof dragonBall !== "object" || dragonBall === null) {
    throw badRequest("invalid_dragon_ball", "Dragon ball metadata is invalid");
  }

  const input = dragonBall as Record<string, unknown>;
  const profession = typeof input.profession === "string" ? input.profession.trim() : "";
  const quality = typeof input.quality === "string" ? input.quality.trim() : "";
  const attributes = typeof input.attributes === "string" ? input.attributes.trim() : "";
  const element = dragonBallElementForProfession(profession);

  if (
    !profession ||
    !quality ||
    !attributes ||
    attributes.length > 200 ||
    !isDragonBallProfession(profession) ||
    !isDragonBallQuality(quality) ||
    !element
  ) {
    throw badRequest("invalid_dragon_ball", "Dragon ball metadata is invalid");
  }

  return {
    itemCategory: "龙珠",
    dragonBall: {
      element,
      profession,
      quality,
      attributes
    }
  };
}

function normalizeCreateAssetInput(input: CreateAssetDraftInput, originalEndAtIso: string): CreateAssetInput {
  if (
    !isNonEmptyString(input.gameName) ||
    !isNonEmptyString(input.principalId) ||
    !isNonEmptyString(input.serverName) ||
    !isNonEmptyString(input.assetType) ||
    !isNonEmptyString(input.title) ||
    !isNonEmptyString(input.description)
  ) {
    throw badRequest("invalid_asset", "Required asset fields are missing");
  }

  const originalEndAt = new Date(originalEndAtIso);
  const originalEndAtTime = originalEndAt.getTime();
  if (
    !Number.isFinite(originalEndAtTime) ||
    originalEndAt.toISOString() !== originalEndAtIso ||
    originalEndAtTime <= Date.now()
  ) {
    throw badRequest("invalid_end_time", "Auction end time must be in the future");
  }

  if (!isPositiveWholeYuanCents(input.startingPriceCents)) {
    throw badRequest("invalid_price", "Starting price must be a positive whole amount");
  }
  if (!isPositiveWholeYuanCents(input.minIncrementCents)) {
    throw badRequest("invalid_increment", "Minimum increment must be a positive whole amount");
  }
  const assetType = input.assetType.trim();
  const dragonBallMetadata = normalizeDragonBallInput(assetType, input.itemCategory, input.dragonBall);
  return {
    ...input,
    sellerGameId: isNonEmptyString(input.sellerGameId) ? input.sellerGameId.trim() : null,
    gameName: input.gameName.trim(),
    serverName: input.serverName.trim(),
    assetType,
    itemCategory: dragonBallMetadata.itemCategory,
    dragonBall: dragonBallMetadata.dragonBall,
    title: input.title.trim(),
    description: input.description.trim(),
    originalEndAt: originalEndAtIso,
    images: sanitizeImages(input.images)
  };
}

export function createAssetsService(repository: AssetsRepository) {
  return {
    async createPending(input: CreateAssetDraftInput) {
      const originalEndAtIso = isNonEmptyString(input.originalEndAt) ? input.originalEndAt.trim() : DEFAULT_ASSET_END_AT;
      return repository.createPending(normalizeCreateAssetInput(input, originalEndAtIso));
    },
    async createActive(input: CreateActiveAssetInput) {
      const asset = await repository.createPending(normalizeCreateAssetInput(input, input.endAt.trim()));
      return repository.save({
        ...asset,
        status: "active",
        originalEndAt: input.endAt.trim(),
        effectiveEndAt: input.endAt.trim()
      });
    },
    async listActive(input: PublicAssetListInput = {}) {
      return repository.listActive({
        ...input,
        nowIso: input.nowIso ?? new Date().toISOString()
      });
    },
    async detail(id: string) {
      const asset = await repository.findById(id);
      if (!asset) {
        throw notFound("asset_not_found", "Asset not found");
      }
      return asset;
    }
  };
}
