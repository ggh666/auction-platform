import type { FastifyInstance } from "fastify";
import type { AuctionAsset, ProfileResultItem, ProfileResultsResponse } from "@auction/shared";
import { createSettlementService } from "../settlement/settlement.service";
import type { Env } from "../../config/env";
import { requireUser } from "../../http/auth";
import { gone } from "../../http/errors";
import { createAuthService, type WechatCodeSessionExchanger } from "./auth.service";
import { paginateItems, readPagination, type PageQuery } from "../admin/pagination";
import type { AssetsRepository } from "../assets/assets.repository";
import type { BidsRepository } from "../bids/bids.repository";
import { toPublicAsset } from "../assets/publicAsset";
import type { UsersRepository } from "../users/users.repository";

export type AuthRouteOptions = {
  enableMockAuth: boolean;
  env: Pick<Env, "nodeEnv" | "wechatAppId" | "wechatAppSecret">;
  wechatCodeSessionExchanger?: WechatCodeSessionExchanger;
};

function resultAssetSummary(asset: AuctionAsset): ProfileResultItem["asset"] {
  return {
    id: asset.id,
    title: asset.title,
    gameName: asset.gameName,
    serverName: asset.serverName,
    assetType: asset.assetType
  };
}

function sortResultAssets(left: AuctionAsset, right: AuctionAsset): number {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
    Number(right.id) - Number(left.id)
  );
}

export function registerAuthRoutes(app: FastifyInstance, users: UsersRepository, options: AuthRouteOptions): void {
  const auth = createAuthService(app, users, {
    env: options.env,
    wechatCodeSessionExchanger: options.wechatCodeSessionExchanger
  });

  app.post<{ Body: { displayName?: unknown } }>("/api/auth/mock-login", async (request, reply) => {
    if (!options.enableMockAuth) {
      return reply.status(404).send({ error: { code: "not_found", message: "Route not found" } });
    }

    return auth.mockLogin(request.body?.displayName);
  });

  app.post<{ Body: unknown }>("/api/auth/wechat-login", async (request) => {
    return auth.wechatLogin(request.body);
  });

  app.get("/api/profile/me", { preHandler: requireUser }, async (request, reply) => {
    const user = await users.findById(Number(request.user.id));
    if (!user) {
      return reply.status(404).send({ error: { code: "not_found", message: "User not found" } });
    }
    return {
      user: {
        id: String(user.id),
        displayName: user.display_name,
        avatarUrl: user.avatar_url ?? undefined,
        banned: user.banned_at !== null,
        violationCount: user.violation_count,
        creditScore: user.credit_score,
        creditResetAt: user.credit_reset_at === null ? null : new Date(user.credit_reset_at).toISOString(),
        buyerUnreachableCount: user.buyer_unreachable_count,
        bidRestrictedUntil: user.bid_restricted_until === null ? null : new Date(user.bid_restricted_until).toISOString()
      }
    };
  });
}

export function registerProfileRoutes(
  app: FastifyInstance,
  deps: { assets: AssetsRepository; bids: BidsRepository }
): void {
  const settlement = createSettlementService();

  app.get("/api/profile/assets", async () => {
    throw gone("user_asset_records_disabled", "Miniapp user published asset records are disabled");
  });

  app.get("/api/profile/bids", { preHandler: requireUser }, async (request) => {
    const bidRecords = await deps.bids.listByBidder(request.user.id);
    const items = [];
    for (const bid of bidRecords) {
      const asset = await deps.assets.findById(bid.assetId);
      if (asset) {
        items.push({ ...bid, asset: toPublicAsset(asset) });
      }
    }
    return { items };
  });

  app.get<{ Querystring: PageQuery; Reply: ProfileResultsResponse }>("/api/profile/results", { preHandler: requireUser }, async (request) => {
    const { page, pageSize } = readPagination(request.query);
    const assets = await deps.assets.listRelatedResults(request.user.id);
    const items = assets
      .sort(sortResultAssets)
      .map((asset) => ({
        ...settlement.settleAsset(asset),
        asset: resultAssetSummary(asset)
      }));
    const result = paginateItems(items, page, pageSize);
    return { ...result, hasMore: result.page * result.pageSize < result.total };
  });
}
