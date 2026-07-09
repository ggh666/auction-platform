import type { FastifyInstance } from "fastify";
import { isDragonBallProfession, isDragonBallQuality } from "@auction/shared";
import { readOptionalUserId, requireActiveUser, requireUser } from "../../http/auth";
import { HttpError, badRequest, notFound } from "../../http/errors";
import type { AssetFollowsRepository } from "../assetFollows/assetFollows.repository";
import type { BidsRepository } from "../bids/bids.repository";
import { assertLocalMarketplaceTextAllowed, type ContentSafetyService } from "../contentSafety/contentSafety.service";
import type { SystemConfigsRepository } from "../configs/configs.repository";
import {
  readUserAssetPublishConfig,
  USER_ASSET_PUBLISH_DISABLED_REASON
} from "../configs/publishConfig";
import type { PrincipalsRepository } from "../principals/principals.repository";
import type { ReportsService, ViolationRecord } from "../reports/reports.service";
import { readUserSummary, toBidDisplayRecord } from "../users/userSummary";
import type { UsersRepository } from "../users/users.repository";
import type { AssetsRepository } from "./assets.repository";
import { createAssetsService } from "./assets.service";
import { toPublicAsset } from "./publicAsset";
import type { AssetCreateResponse, AssetDetailResponse, AssetListResponse, AssetPublishContextResponse, AuctionAsset, PrincipalListResponse } from "@auction/shared";

const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;

type AssetListQuery = {
  gameName?: unknown;
  assetType?: unknown;
  principalId?: unknown;
  dragonBallProfession?: unknown;
  dragonBallQuality?: unknown;
  keyword?: unknown;
  page?: unknown;
  pageSize?: unknown;
  createdWithinDays?: unknown;
};

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function principalIdQuery(value: unknown): string | undefined {
  const raw = stringQuery(value);
  if (!raw) {
    return undefined;
  }
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0) {
    throw badRequest("invalid_principal_filter", "principalId filter is invalid");
  }
  return raw;
}

function dragonBallProfessionQuery(value: unknown): string | undefined {
  const raw = stringQuery(value);
  if (!raw) {
    return undefined;
  }
  if (!isDragonBallProfession(raw)) {
    throw badRequest("invalid_dragon_ball_profession", "Dragon Ball profession filter is invalid");
  }
  return raw;
}

function dragonBallQualityQuery(value: unknown): string | undefined {
  const raw = stringQuery(value);
  if (!raw) {
    return undefined;
  }
  if (!isDragonBallQuality(raw)) {
    throw badRequest("invalid_dragon_ball_quality", "Dragon Ball quality filter is invalid");
  }
  return raw;
}

function numberQuery(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function optionalNumberQuery(value: unknown, max: number): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.min(parsed, max);
}

function daysAgoIso(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function chinaDayStartIso(now = new Date()): string {
  const shifted = new Date(now.getTime() + CHINA_TIME_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - CHINA_TIME_OFFSET_MS).toISOString();
}

function readDragonBallTextFields(value: unknown): string[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }
  const input = value as Record<string, unknown>;
  return [input.profession, input.quality, input.attributes].filter((field): field is string => typeof field === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildViolationSummary(violations: ViolationRecord[]) {
  const assetIds = new Set<string>();

  for (const violation of violations) {
    if (violation.assetId) {
      assetIds.add(violation.assetId);
    }
  }

  return { assetIds };
}

function enrichAssetWithViolations(
  asset: AuctionAsset,
  summary: ReturnType<typeof buildViolationSummary>
): AuctionAsset {
  return {
    ...asset,
    sellerViolationCount: 0,
    hasPublishedViolation: summary.assetIds.has(asset.id)
  };
}

function enrichAssetWithFollow(asset: AuctionAsset, followedAssetIds: Set<string>): AuctionAsset {
  return {
    ...asset,
    followedByMe: followedAssetIds.has(asset.id)
  };
}

async function enrichAssetWithPrincipal(asset: AuctionAsset, principals: PrincipalsRepository): Promise<AuctionAsset> {
  if (!asset.principalId) {
    return { ...asset, principal: null };
  }
  const principal = await principals.findById(asset.principalId);
  return {
    ...asset,
    principal: principal ? { id: principal.id, displayName: principal.displayName } : null
  };
}

function isPubliclyFollowable(asset: AuctionAsset, now = new Date()): boolean {
  return asset.status === "active" && new Date(asset.effectiveEndAt).getTime() > now.getTime();
}

function isPubliclyViewable(asset: AuctionAsset, now = new Date()): boolean {
  const isActive = asset.status === "active" && new Date(asset.effectiveEndAt).getTime() > now.getTime();
  const isConfirmedDeal = asset.status === "ended" && asset.currentPriceCents !== null && asset.highestBidderId !== null;
  return isActive || isConfirmedDeal;
}

async function readFollowedAssetIds(
  request: Parameters<typeof readOptionalUserId>[0],
  assetFollows: AssetFollowsRepository,
  assetIds: string[]
): Promise<Set<string>> {
  const userId = await readOptionalUserId(request);
  return userId ? assetFollows.listFollowedAssetIdsIn(userId, assetIds) : new Set<string>();
}

async function readRemainingDailyPublishCount(
  assets: AssetsRepository,
  users: UsersRepository,
  configs: SystemConfigsRepository,
  userId: string
): Promise<number> {
  const user = await users.findById(Number(userId));
  const publishConfig = await readUserAssetPublishConfig(configs);
  const limit = user?.daily_publish_limit ?? publishConfig.defaultDailyPublishLimit;
  const createdToday = await assets.countCreatedBySellerSince(userId, chinaDayStartIso());
  return Math.max(0, limit - createdToday);
}

function publishText(input: Record<string, unknown>): string {
  return [
    input.gameName,
    input.serverName,
    input.assetType,
    input.sellerGameId,
    input.title,
    input.description,
    ...readDragonBallTextFields(input.dragonBall)
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

export function registerAssetRoutes(
  app: FastifyInstance,
  assets: AssetsRepository,
  users: UsersRepository,
  bids: BidsRepository,
  configs: SystemConfigsRepository,
  reports: ReportsService,
  contentSafety: ContentSafetyService,
  principals: PrincipalsRepository,
  assetFollows: AssetFollowsRepository
): void {
  const service = createAssetsService(assets);

  app.get<{ Reply: PrincipalListResponse }>("/api/principals", async () => {
    return { items: await principals.listActive() };
  });

  app.get<{ Reply: AssetPublishContextResponse }>(
    "/api/asset-publish-context",
    { preHandler: requireActiveUser(users) },
    async (request) => {
      if (!request.user?.id) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const publishConfig = await readUserAssetPublishConfig(configs);
      return {
        enabled: publishConfig.enabled,
        disabledReason: publishConfig.enabled ? null : USER_ASSET_PUBLISH_DISABLED_REASON,
        principals: await principals.listActive(),
        defaultMinIncrementCents: publishConfig.defaultMinIncrementCents,
        remainingDailyPublishCount: await readRemainingDailyPublishCount(assets, users, configs, request.user.id),
        imagePolicy: publishConfig.imagePolicy
      };
    }
  );

  app.get<{ Querystring: AssetListQuery; Reply: AssetListResponse }>("/api/assets", async (request) => {
    const keyword = stringQuery(request.query.keyword);
    const page = numberQuery(request.query.page, 1, 100000);
    const pageSize = numberQuery(request.query.pageSize, 20, 100);
    const createdWithinDays = optionalNumberQuery(request.query.createdWithinDays, 365);
    const result = await service.listActive({
      gameName: stringQuery(request.query.gameName),
      assetType: stringQuery(request.query.assetType),
      principalId: principalIdQuery(request.query.principalId),
      dragonBallProfession: dragonBallProfessionQuery(request.query.dragonBallProfession),
      dragonBallQuality: dragonBallQualityQuery(request.query.dragonBallQuality),
      keyword,
      createdSince: createdWithinDays ? daysAgoIso(createdWithinDays) : undefined,
      page,
      pageSize
    });
    const violationSummary = buildViolationSummary(await reports.listPublicViolations());
    const followedAssetIds = await readFollowedAssetIds(
      request,
      assetFollows,
      result.items.map((asset) => asset.id)
    );

    return {
      items: await Promise.all(
        result.items.map((asset) =>
          enrichAssetWithPrincipal(enrichAssetWithFollow(enrichAssetWithViolations(asset, violationSummary), followedAssetIds), principals).then(
            toPublicAsset
          )
        )
      ),
      nextCursor: null,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.page * result.pageSize < result.total
    };
  });

  app.get<{ Querystring: Pick<AssetListQuery, "page" | "pageSize">; Reply: AssetListResponse }>(
    "/api/profile/follows",
    { preHandler: requireUser },
    async (request) => {
      const page = numberQuery(request.query.page, 1, 100000);
      const pageSize = numberQuery(request.query.pageSize, 20, 100);
      const result = await assetFollows.listByUser(request.user.id, { page, pageSize });
      const violationSummary = buildViolationSummary(await reports.listPublicViolations());
      const items: AuctionAsset[] = [];

      for (const follow of result.items) {
        const asset = await assets.findById(follow.assetId);
        if (!asset) {
          continue;
        }
        items.push(
          toPublicAsset(
            await enrichAssetWithPrincipal(
              enrichAssetWithFollow(enrichAssetWithViolations(asset, violationSummary), new Set([asset.id])),
              principals
            )
          )
        );
      }

      return {
        items,
        nextCursor: null,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.page * result.pageSize < result.total
      };
    }
  );

  app.post<{ Body: unknown; Reply: AssetCreateResponse }>("/api/assets", { preHandler: requireActiveUser(users) }, async (request) => {
    if (!request.user?.id) {
      throw new HttpError(401, "unauthorized", "Authentication required");
    }
    if (!isRecord(request.body)) {
      throw badRequest("invalid_asset", "Asset payload is invalid");
    }
    const publishConfig = await readUserAssetPublishConfig(configs);
    if (!publishConfig.enabled) {
      throw new HttpError(403, "asset_publish_disabled", "User asset publishing is temporarily disabled");
    }
    const remaining = await readRemainingDailyPublishCount(assets, users, configs, request.user.id);
    if (remaining <= 0) {
      throw new HttpError(403, "daily_publish_limit_exceeded", "Daily publish limit exceeded");
    }
    const principalId = typeof request.body.principalId === "string" ? request.body.principalId.trim() : "";
    const principal = principalId ? await principals.findActiveById(principalId) : null;
    if (!principal) {
      throw badRequest("invalid_asset_principal", "Active principal is required");
    }
    const user = await users.findById(Number(request.user.id));
    if (!user) {
      throw new HttpError(401, "unauthorized", "Authentication required");
    }

    assertLocalMarketplaceTextAllowed(publishText(request.body));
    await contentSafety.assertTextAllowed({ content: publishText(request.body), openid: user.openid });
    await contentSafety.assertImageUploadsAllowed({
      userId: request.user.id,
      images: request.body.images as Parameters<typeof service.createPending>[0]["images"]
    });

    const asset = await service.createPending({
      sellerId: request.user.id,
      sellerGameId: request.body.sellerGameId as string | undefined,
      principalId: principal.id,
      gameName: request.body.gameName as string,
      serverName: request.body.serverName as string,
      assetType: request.body.assetType as string,
      itemCategory: request.body.itemCategory,
      dragonBall: request.body.dragonBall,
      title: request.body.title as string,
      description: request.body.description as string,
      startingPriceCents: request.body.startingPriceCents as number,
      minIncrementCents: request.body.minIncrementCents as number,
      originalEndAt: request.body.originalEndAt as string | undefined,
      images: request.body.images as Parameters<typeof service.createPending>[0]["images"]
    });
    return { asset };
  });

  app.post<{ Params: { assetId: string } }>(
    "/api/assets/:assetId/follow",
    { preHandler: requireActiveUser(users) },
    async (request) => {
      if (!request.user?.id) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const asset = await assets.findById(request.params.assetId);
      if (!asset || !isPubliclyFollowable(asset)) {
        throw notFound("asset_not_followable", "Asset is not followable");
      }
      await assetFollows.follow(request.user.id, asset.id);
      return { assetId: asset.id, followed: true };
    }
  );

  app.post<{ Params: { assetId: string } }>(
    "/api/assets/:assetId/unfollow",
    { preHandler: requireActiveUser(users) },
    async (request) => {
      if (!request.user?.id) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      await assetFollows.unfollow(request.user.id, request.params.assetId);
      return { assetId: request.params.assetId, followed: false };
    }
  );

  app.get<{ Params: { assetId: string }; Reply: AssetDetailResponse }>("/api/assets/:assetId", async (request) => {
    const asset = await service.detail(request.params.assetId);
    const recentBids = await bids.listByAsset(asset.id);
    const viewerUserId = await readOptionalUserId(request);
    const viewerIsParticipant =
      viewerUserId !== null && (viewerUserId === asset.sellerId || recentBids.some((bid) => bid.bidderId === viewerUserId));
    if (!isPubliclyViewable(asset) && !viewerIsParticipant) {
      throw notFound("asset_not_found", "Asset not found");
    }
    const violationSummary = buildViolationSummary(await reports.listPublicViolations());
    const followedAssetIds = await readFollowedAssetIds(request, assetFollows, [asset.id]);
    return {
      asset: toPublicAsset(
        await enrichAssetWithPrincipal(enrichAssetWithFollow(enrichAssetWithViolations(asset, violationSummary), followedAssetIds), principals)
      ),
      seller: await readUserSummary(users, asset.sellerId),
      recentBids: await Promise.all(recentBids.slice(-20).reverse().map((bid) => toBidDisplayRecord(users, bid))),
      principalContact: {
        enabled: Boolean(asset.principalId && viewerIsParticipant),
        reason: principalContactReason(asset.principalId, viewerUserId, viewerIsParticipant)
      }
    };
  });
}

function principalContactReason(principalId: string | null, viewerUserId: string | null, viewerIsParticipant: boolean): string | null {
  if (!principalId) {
    return "该资产暂无主理人";
  }
  if (!viewerUserId) {
    return "登录后联系主理人";
  }
  if (!viewerIsParticipant) {
    return "参与估价后可联系主理人";
  }
  return null;
}
