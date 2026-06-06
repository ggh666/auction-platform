import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify, { type FastifyInstance } from "fastify";
import { readEnv } from "./config/env";
import { HttpError } from "./http/errors";
import { createInMemoryAdminRepository, type AdminRepository } from "./modules/admin/admin.repository";
import { registerAdminConfigRoutes } from "./modules/admin/adminConfigs.routes";
import { registerAdminDashboardRoutes } from "./modules/admin/adminDashboard.routes";
import { registerAdminRoutes } from "./modules/admin/admin.routes";
import { registerAdminUserRoutes } from "./modules/admin/adminUsers.routes";
import { createInMemoryAssetFollowsRepository, type AssetFollowsRepository } from "./modules/assetFollows/assetFollows.repository";
import {
  createInMemoryAssetConversationsRepository,
  type AssetConversationsRepository
} from "./modules/assetConversations/assetConversations.repository";
import { registerAssetConversationRoutes } from "./modules/assetConversations/assetConversations.routes";
import { createInMemoryAssetsRepository, type AssetsRepository } from "./modules/assets/assets.repository";
import { registerAssetRoutes } from "./modules/assets/assets.routes";
import { createInMemoryBidsRepository, type BidsRepository } from "./modules/bids/bids.repository";
import { registerBidRoutes } from "./modules/bids/bids.routes";
import type { WechatCodeSessionExchanger } from "./modules/auth/auth.service";
import { registerAuthRoutes, registerProfileRoutes } from "./modules/auth/auth.routes";
import { type ContentSafetyService } from "./modules/contentSafety/contentSafety.service";
import { createInMemoryImageSafetyRepository, type ImageSafetyRepository } from "./modules/contentSafety/imageSafety.repository";
import { createWechatAccessTokenProvider } from "./modules/contentSafety/wechatAccessToken.service";
import { createWechatContentSafetyService } from "./modules/contentSafety/wechatContentSafety.service";
import { registerWechatEventRoutes } from "./modules/contentSafety/wechatEvent.routes";
import { createWechatMediaCheckUrl } from "./modules/contentSafety/wechatMediaProxy";
import { registerWechatMediaProxyRoutes } from "./modules/contentSafety/wechatMediaProxy.routes";
import { createInMemorySystemConfigsRepository, type SystemConfigsRepository } from "./modules/configs/configs.repository";
import { registerImageRoutes } from "./modules/images/images.routes";
import { createR2ImageStorage, type ImageStorage } from "./modules/images/r2Storage";
import { createInMemoryNotificationsRepository, type NotificationsRepository } from "./modules/notifications/notifications.repository";
import { registerNotificationRoutes } from "./modules/notifications/notifications.routes";
import { createInMemoryPrincipalsRepository, type PrincipalsRepository } from "./modules/principals/principals.repository";
import { createInMemoryDealFollowupsRepository, type DealFollowupsRepository } from "./modules/dealFollowups/dealFollowups.repository";
import { registerDealFollowupRoutes } from "./modules/dealFollowups/dealFollowups.routes";
import { registerReportRoutes } from "./modules/reports/reports.routes";
import { createReportsService, type ReportsService } from "./modules/reports/reports.service";
import {
  createWechatSubscribeMessageService,
  type SubscribeMessageService
} from "./modules/subscribeMessages/subscribeMessage.service";
import { createInMemoryUsersRepository, type UsersRepository } from "./modules/users/users.repository";
import { AuctionHub } from "./realtime/auctionHub";
import { MessageHub } from "./realtime/messageHub";
import { attachAuctionWsServer } from "./realtime/wsServer";
import { attachMessageWsServer } from "./realtime/messageWsServer";

type FastifyStatusError = Error & { statusCode: number };
const jsonBodyLimitBytes = 8 * 1024 * 1024;

function hasHttpStatusCode(error: unknown): error is FastifyStatusError {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
  );
}

function sendInternalError(reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }) {
  return reply.status(500).send({ error: { code: "internal_error", message: "Internal server error" } });
}

function registerJsonContentParser(app: FastifyInstance): void {
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    const rawBody = typeof body === "string" ? body : body.toString("utf8");
    if (!rawBody.trim()) {
      done(null, {});
      return;
    }

    try {
      done(null, JSON.parse(rawBody) as unknown);
    } catch (error) {
      const parseError = new Error(error instanceof Error ? error.message : "Invalid JSON body") as Error & {
        statusCode: number;
      };
      parseError.statusCode = 400;
      done(parseError);
    }
  });
}

export type AppOptions = {
  enableMockAuth?: boolean;
  usersRepository?: UsersRepository;
  assetsRepository?: AssetsRepository;
  adminRepository?: AdminRepository;
  bidsRepository?: BidsRepository;
  reportsService?: ReportsService;
  assetFollowsRepository?: AssetFollowsRepository;
  assetConversationsRepository?: AssetConversationsRepository;
  principalsRepository?: PrincipalsRepository;
  configsRepository?: SystemConfigsRepository;
  notificationsRepository?: NotificationsRepository;
  dealFollowupsRepository?: DealFollowupsRepository;
  imageStorage?: ImageStorage;
  contentSafetyService?: ContentSafetyService;
  subscribeMessageService?: SubscribeMessageService;
  imageSafetyRepository?: ImageSafetyRepository;
  hub?: Pick<AuctionHub, "publish">;
  messageHub?: MessageHub;
  env?: NodeJS.ProcessEnv;
  wechatCodeSessionExchanger?: WechatCodeSessionExchanger;
};

export function buildApp(options: AppOptions = {}) {
  const env = readEnv(options.env);
  if (
    env.nodeEnv === "production" &&
    (!options.usersRepository ||
      !options.assetsRepository ||
      !options.adminRepository ||
      !options.bidsRepository ||
      !options.reportsService ||
      !options.assetFollowsRepository ||
      !options.assetConversationsRepository ||
      !options.principalsRepository ||
      !options.configsRepository ||
      !options.notificationsRepository ||
      !options.dealFollowupsRepository ||
      (env.contentSafetyEnabled && !options.imageSafetyRepository && !options.contentSafetyService))
  ) {
    throw new Error("Production repositories must be explicitly configured; in-memory repositories are development only");
  }

  const app = Fastify({ logger: env.nodeEnv === "test" ? false : { level: env.logLevel }, bodyLimit: jsonBodyLimitBytes });
  registerJsonContentParser(app);
  const users = options.usersRepository ?? createInMemoryUsersRepository();
  const assets = options.assetsRepository ?? createInMemoryAssetsRepository();
  const admins = options.adminRepository ?? createInMemoryAdminRepository();
  const reports = options.reportsService ?? createReportsService();
  const assetFollows = options.assetFollowsRepository ?? createInMemoryAssetFollowsRepository();
  const assetConversations = options.assetConversationsRepository ?? createInMemoryAssetConversationsRepository();
  const principals = options.principalsRepository ?? createInMemoryPrincipalsRepository();
  const bids = options.bidsRepository ?? createInMemoryBidsRepository((asset) => assets.save(asset), (assetId) => assets.findById(assetId));
  const configs = options.configsRepository ?? createInMemorySystemConfigsRepository();
  const notifications = options.notificationsRepository ?? createInMemoryNotificationsRepository();
  const dealFollowups = options.dealFollowupsRepository ?? createInMemoryDealFollowupsRepository();
  const imageStorage = options.imageStorage ?? createR2ImageStorage(env);
  const imageSafety = options.imageSafetyRepository ?? createInMemoryImageSafetyRepository();
  const wechatTokenProvider = createWechatAccessTokenProvider({ env });
  const contentSafety =
    options.contentSafetyService ??
    createWechatContentSafetyService({
      enabled: env.contentSafetyEnabled,
      strict: env.contentSafetyStrict,
      tokenProvider: wechatTokenProvider,
      imageSafetyRepository: imageSafety,
      assetsRepository: assets,
      usersRepository: users,
      imageCheckUrlBuilder: ({ objectKey }) =>
        createWechatMediaCheckUrl({
          baseUrl: env.apiPublicBaseUrl,
          objectKey,
          secret: env.jwtSecret
        })
    });
  const subscribeMessages =
    options.subscribeMessageService ??
    createWechatSubscribeMessageService({
      priceChangeTemplateId: env.wechatPriceChangeSubscribeTemplateId,
      miniprogramState: env.wechatSubscribeMessageMiniprogramState,
      tokenProvider: wechatTokenProvider
    });
  const auctionHub = new AuctionHub();
  const hub = options.hub ?? auctionHub;
  const messageHub = options.messageHub ?? new MessageHub();
  const enableMockAuth = env.nodeEnv !== "production" && (options.enableMockAuth ?? env.nodeEnv === "development");

  app.register(cors, { origin: env.corsAllowedOrigins });
  app.register(jwt, { secret: env.jwtSecret });

  app.get("/health", async () => ({ ok: true, service: "auction-api" }));
  registerAuthRoutes(app, users, {
    enableMockAuth,
    env,
    wechatCodeSessionExchanger: options.wechatCodeSessionExchanger
  });
  registerWechatEventRoutes(app, contentSafety, env);
  registerWechatMediaProxyRoutes(app, imageStorage, env);
  registerProfileRoutes(app, { assets, bids });
  registerNotificationRoutes(app, notifications, users);
  registerDealFollowupRoutes(app, {
    admins,
    assets,
    followups: dealFollowups,
    principals,
    users
  });
  registerImageRoutes(app, imageStorage, users, contentSafety, configs);
  registerAssetConversationRoutes(app, {
    admins,
    assets,
    bids,
    users,
    principals,
    conversations: assetConversations,
    contentSafety,
    messageHub
  });
  registerAssetRoutes(app, assets, users, bids, configs, reports, contentSafety, principals, assetFollows);
  registerAdminDashboardRoutes(app, admins, { assets, bids, reports, users, principals });
  registerAdminRoutes(app, admins, assets, bids, users, contentSafety, principals, dealFollowups, imageSafety, imageStorage, notifications, hub);
  registerAdminUserRoutes(app, admins, users);
  registerAdminConfigRoutes(app, admins, configs);
  registerBidRoutes(app, { assets, bids, hub, users, notifications, subscribeMessages });
  registerReportRoutes(app, reports, admins, users, assets, bids, contentSafety, principals);

  if (!options.hub) {
    const wss = attachAuctionWsServer(app.server, auctionHub);
    app.addHook("onClose", (_instance, done) => {
      wss.close(done);
    });
  }
  if (!options.messageHub) {
    const messageWss = attachMessageWsServer(app, { admins, users, principals, hub: messageHub });
    app.addHook("onClose", (_instance, done) => {
      messageWss.close(done);
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      if (error.statusCode >= 500) {
        app.log.error(error);
        return sendInternalError(reply);
      }

      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details }
      });
    }

    if (hasHttpStatusCode(error)) {
      if (error.statusCode >= 500) {
        app.log.error(error);
        return sendInternalError(reply);
      }

      return reply.status(error.statusCode).send({
        error: { code: "request_error", message: error.message }
      });
    }

    app.log.error(error);
    return sendInternalError(reply);
  });

  return app;
}
