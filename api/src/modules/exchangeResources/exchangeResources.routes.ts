import type {
  AssetConversationResponse,
  ExchangeResourceContextResponse,
  ExchangeResourceCreateRequest,
  ExchangeResourceListResponse,
  ExchangeResourceResponse
} from "@auction/shared";
import type { ImageSafetyStatus } from "../contentSafety/contentSafety.service";
import type { FastifyInstance } from "fastify";
import { requireActiveUser, requireAdmin } from "../../http/auth";
import { HttpError, badRequest, notFound } from "../../http/errors";
import type { AdminRepository } from "../admin/admin.repository";
import { readPagination, type PageQuery } from "../admin/pagination";
import {
  FREE_EXCHANGE_PUBLISH_DISABLED_REASON,
  readFreeExchangePublishConfig
} from "../configs/publishConfig";
import type { SystemConfigsRepository } from "../configs/configs.repository";
import type { ContentSafetyService } from "../contentSafety/contentSafety.service";
import type { UsersRepository } from "../users/users.repository";
import { readUserSummary } from "../users/userSummary";
import type { AssetConversationsRepository } from "../assetConversations/assetConversations.repository";
import type { ExchangeResourcesRepository } from "./exchangeResources.repository";
import { exchangeResourceSafetyText, normalizeExchangeResourceInput } from "./exchangeResources.service";

type ExchangeResourceQuery = PageQuery & {
  gameName?: unknown;
  dragonBallProfession?: unknown;
  dragonBallQuality?: unknown;
  keyword?: unknown;
};

type AdminExchangeResourceQuery = ExchangeResourceQuery & {
  status?: unknown;
};

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readGameName(value: unknown): string {
  return stringQuery(value) ?? "塔防精灵";
}

function readExchangeResourceStatus(value: unknown) {
  const status = stringQuery(value);
  if (!status) {
    return undefined;
  }
  if (status === "pending_image_review" || status === "active" || status === "closed" || status === "removed" || status === "expired") {
    return status;
  }
  throw badRequest("invalid_exchange_resource_status", "Exchange resource status is invalid");
}

function imageReviewIsPublic(status: ImageSafetyStatus) {
  return status === "pass" || status === "review";
}

async function readExchangeImagePublishStatus(
  contentSafety: ContentSafetyService,
  userId: string,
  image: ExchangeResourceCreateRequest["image"]
) {
  const images = [{ objectKey: image.objectKey, publicUrl: image.publicUrl }];
  await contentSafety.assertImageUploadsAllowed({ userId, images });
  const statuses = await contentSafety.readImageUploadSafetyStatuses?.({ userId, images });
  const status = statuses?.[0];
  if (!status || imageReviewIsPublic(status)) {
    return "active" as const;
  }
  if (status === "pending") {
    return "pending_image_review" as const;
  }
  throw badRequest("invalid_exchange_resource_image", "Exchange resource image is invalid");
}

async function refreshExchangeResourceLifecycle(deps: {
  contentSafety: ContentSafetyService;
  exchangeResources: ExchangeResourcesRepository;
}) {
  await deps.exchangeResources.expireDue();
  if (!deps.contentSafety.readImageUploadSafetyStatuses) {
    return;
  }

  const pendingResources = await deps.exchangeResources.listPendingImageReview();
  for (const resource of pendingResources) {
    try {
      const [status] = await deps.contentSafety.readImageUploadSafetyStatuses({
        userId: resource.publisherId,
        images: [{ objectKey: resource.imageObjectKey, publicUrl: resource.imageUrl }]
      });
      if (status && imageReviewIsPublic(status)) {
        await deps.exchangeResources.activateImageReviewed(resource.id);
      }
    } catch {
      // Keep the resource hidden while the image safety record is missing or still unresolved.
    }
  }
}

export function registerExchangeResourceRoutes(
  app: FastifyInstance,
  deps: {
    admins: AdminRepository;
    users: UsersRepository;
    configs: SystemConfigsRepository;
    contentSafety: ContentSafetyService;
    exchangeResources: ExchangeResourcesRepository;
    conversations: AssetConversationsRepository;
  }
): void {
  app.get<{ Querystring: { gameName?: unknown }; Reply: ExchangeResourceContextResponse }>(
    "/api/exchange-resources/context",
    async (request) => {
      const publishConfig = await readFreeExchangePublishConfig(deps.configs);
      return {
        enabled: publishConfig.enabled,
        disabledReason: publishConfig.enabled ? null : FREE_EXCHANGE_PUBLISH_DISABLED_REASON,
        gameName: readGameName(request.query.gameName),
        supportedItemCategories: ["龙珠"]
      };
    }
  );

  app.get<{ Querystring: AdminExchangeResourceQuery; Reply: ExchangeResourceListResponse }>(
    "/admin/exchange-resources",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async (request) => {
      await refreshExchangeResourceLifecycle(deps);
      return deps.exchangeResources.listForAdmin({
        ...readPagination(request.query),
        status: readExchangeResourceStatus(request.query.status),
        gameName: stringQuery(request.query.gameName),
        dragonBallProfession: stringQuery(request.query.dragonBallProfession),
        dragonBallQuality: stringQuery(request.query.dragonBallQuality),
        keyword: stringQuery(request.query.keyword)
      });
    }
  );

  app.get<{ Querystring: ExchangeResourceQuery; Reply: ExchangeResourceListResponse }>(
    "/api/exchange-resources",
    async (request) => {
      await refreshExchangeResourceLifecycle(deps);
      return deps.exchangeResources.listActive({
        ...readPagination(request.query),
        gameName: stringQuery(request.query.gameName),
        dragonBallProfession: stringQuery(request.query.dragonBallProfession),
        dragonBallQuality: stringQuery(request.query.dragonBallQuality),
        keyword: stringQuery(request.query.keyword)
      });
    }
  );

  app.get<{ Params: { resourceId: string }; Reply: ExchangeResourceResponse }>(
    "/api/exchange-resources/:resourceId",
    async (request) => {
      await refreshExchangeResourceLifecycle(deps);
      const resource = await deps.exchangeResources.findById(request.params.resourceId);
      if (!resource || resource.status !== "active") {
        throw notFound("exchange_resource_not_found", "Exchange resource not found");
      }
      return { resource };
    }
  );

  app.post<{ Body: ExchangeResourceCreateRequest; Reply: ExchangeResourceResponse }>(
    "/api/exchange-resources",
    { preHandler: requireActiveUser(deps.users) },
    async (request) => {
      const publishConfig = await readFreeExchangePublishConfig(deps.configs);
      if (!publishConfig.enabled) {
        throw new HttpError(403, "exchange_publish_disabled", "Free exchange publishing is temporarily disabled");
      }
      const user = await deps.users.findById(Number(request.user.id));
      if (!user) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const input = normalizeExchangeResourceInput({
        publisher: await readUserSummary(deps.users, request.user.id),
        gameName: request.body?.gameName,
        serverName: request.body?.serverName,
        title: request.body?.title,
        dragonBallAmountCents: request.body?.dragonBallAmountCents,
        dragonBall: request.body?.dragonBall,
        image: request.body?.image,
        desiredExchange: request.body?.desiredExchange,
        description: request.body?.description,
        status: "active"
      });
      await deps.contentSafety.assertTextAllowed({ content: exchangeResourceSafetyText(input), openid: user.openid });
      const status = await readExchangeImagePublishStatus(deps.contentSafety, request.user.id, input.image);
      return { resource: await deps.exchangeResources.create({ ...input, status }) };
    }
  );

  app.get<{ Querystring: PageQuery; Reply: ExchangeResourceListResponse }>(
    "/api/profile/exchange-resources",
    { preHandler: requireActiveUser(deps.users) },
    async (request) => {
      await refreshExchangeResourceLifecycle(deps);
      return deps.exchangeResources.listByPublisher(request.user.id, readPagination(request.query));
    }
  );

  app.post<{ Params: { resourceId: string }; Reply: ExchangeResourceResponse }>(
    "/api/profile/exchange-resources/:resourceId/close",
    { preHandler: requireActiveUser(deps.users) },
    async (request) => {
      await refreshExchangeResourceLifecycle(deps);
      const resource = await deps.exchangeResources.closeByPublisher(request.params.resourceId, request.user.id);
      if (!resource) {
        throw notFound("exchange_resource_not_found", "Exchange resource not found");
      }
      return { resource };
    }
  );

  app.post<{ Params: { resourceId: string }; Reply: AssetConversationResponse }>(
    "/api/exchange-resources/:resourceId/conversations/seller",
    { preHandler: requireActiveUser(deps.users) },
    async (request) => {
      await refreshExchangeResourceLifecycle(deps);
      const resource = await deps.exchangeResources.findById(request.params.resourceId);
      if (!resource || resource.status !== "active") {
        throw notFound("exchange_resource_not_found", "Exchange resource not found");
      }
      if (resource.publisherId === request.user.id) {
        throw new HttpError(403, "seller_conversation_not_allowed", "这是你发布的资源，不能联系自己");
      }
      if (!resource.publisher) {
        throw badRequest("exchange_resource_publisher_missing", "Exchange resource publisher is missing");
      }
      const conversation = await deps.conversations.createOrGetSellerConversation({
        assetSource: "exchange_resource",
        asset: {
          id: resource.id,
          title: resource.title,
          gameName: resource.gameName,
          serverName: resource.serverName,
          assetType: resource.assetType
        },
        user: await readUserSummary(deps.users, request.user.id),
        targetUser: resource.publisher
      });
      return { conversation };
    }
  );
}
