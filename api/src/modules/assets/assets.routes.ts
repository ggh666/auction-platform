import type { FastifyInstance } from "fastify";
import { readOptionalUserId, requireActiveUser, requireUser } from "../../http/auth";
import { HttpError, badRequest, notFound } from "../../http/errors";
import type { AssetFollowsRepository } from "../assetFollows/assetFollows.repository";
import type { BidsRepository } from "../bids/bids.repository";
import type { ContentSafetyService } from "../contentSafety/contentSafety.service";
import type { SystemConfigsRepository } from "../configs/configs.repository";
import type { PrincipalsRepository } from "../principals/principals.repository";
import type { ReportsService, ViolationRecord } from "../reports/reports.service";
import { readUserSummary, toBidDisplayRecord } from "../users/userSummary";
import type { UsersRepository } from "../users/users.repository";
import type { AssetsRepository } from "./assets.repository";
import { createAssetsService } from "./assets.service";
import type { AssetDetailResponse, AssetListResponse, AuctionAsset, PrincipalListResponse } from "@auction/shared";

const DEFAULT_DAILY_PUBLISH_LIMIT = 3;
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;

type AssetListQuery = {
  gameName?: unknown;
  assetType?: unknown;
  keyword?: unknown;
  page?: unknown;
  pageSize?: unknown;
  createdWithinDays?: unknown;
};

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberQuery(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
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

function parseLimit(value: unknown, fallback: number): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0) {
    return fallback;
  }
  return limit;
}

function readDragonBallTextFields(value: unknown): string[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }
  const input = value as Record<string, unknown>;
  return [input.profession, input.quality, input.attributes].filter((field): field is string => typeof field === "string");
}

async function readDefaultDailyPublishLimit(configs: SystemConfigsRepository): Promise<number> {
  const config = (await configs.list()).find((item) => item.key === "default_daily_publish_limit");
  return parseLimit(config?.value, DEFAULT_DAILY_PUBLISH_LIMIT);
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
  return asset.status === "active" && new Date(asset.effectiveEndAt).getTime() > now.getTime();
}

async function readFollowedAssetIds(
  request: Parameters<typeof readOptionalUserId>[0],
  assetFollows: AssetFollowsRepository,
  assetIds: string[]
): Promise<Set<string>> {
  const userId = await readOptionalUserId(request);
  return userId ? assetFollows.listFollowedAssetIdsIn(userId, assetIds) : new Set<string>();
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

  app.get<{ Querystring: AssetListQuery; Reply: AssetListResponse }>("/api/assets", async (request) => {
    const keyword = stringQuery(request.query.keyword);
    const page = numberQuery(request.query.page, 1, 100000);
    const pageSize = numberQuery(request.query.pageSize, 20, 100);
    const createdWithinDays = numberQuery(request.query.createdWithinDays, keyword ? 60 : 7, 365);
    const result = await service.listActive({
      gameName: stringQuery(request.query.gameName),
      assetType: stringQuery(request.query.assetType),
      keyword,
      createdSince: daysAgoIso(createdWithinDays),
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
          enrichAssetWithPrincipal(enrichAssetWithFollow(enrichAssetWithViolations(asset, violationSummary), followedAssetIds), principals)
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
          await enrichAssetWithPrincipal(
            enrichAssetWithFollow(enrichAssetWithViolations(asset, violationSummary), new Set([asset.id])),
            principals
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

  app.post<{ Body: Omit<Parameters<typeof service.createPending>[0], "sellerId"> }>(
    "/api/assets",
    { preHandler: requireActiveUser(users) },
    async (request) => {
      if (!request.user?.id) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const user = await users.findById(Number(request.user.id));
      if (!user) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const defaultLimit = await readDefaultDailyPublishLimit(configs);
      const limit = user.daily_publish_limit === null ? defaultLimit : user.daily_publish_limit;
      const used = await assets.countCreatedBySellerSince(request.user.id, chinaDayStartIso());
      if (used >= limit) {
        throw badRequest("publish_limit_reached", "Daily publish limit reached", { limit, used });
      }
      const principalId = typeof request.body.principalId === "string" ? request.body.principalId.trim() : "";
      const principal = principalId ? await principals.findActiveById(principalId) : null;
      if (!principal) {
        throw badRequest("invalid_asset_principal", "Active principal is required");
      }
      await contentSafety.assertImageUploadsAllowed({
        userId: request.user.id,
        images: request.body.images
      });
      await contentSafety.assertTextAllowed({
        content: [
          request.body.gameName,
          request.body.serverName,
          request.body.assetType,
          request.body.itemCategory,
          request.body.title,
          request.body.description,
          ...readDragonBallTextFields(request.body.dragonBall)
        ]
          .filter((value): value is string => typeof value === "string")
          .join("\n"),
        openid: user.openid,
        scene: 3
      });
      const asset = await service.createPending({
        ...request.body,
        principalId: principal.id,
        sellerId: request.user.id
      });
      return { asset };
    }
  );

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
      asset: await enrichAssetWithPrincipal(enrichAssetWithFollow(enrichAssetWithViolations(asset, violationSummary), followedAssetIds), principals),
      seller: await readUserSummary(users, asset.sellerId),
      recentBids: await Promise.all(recentBids.slice(-20).reverse().map((bid) => toBidDisplayRecord(users, bid)))
    };
  });
}
