import type {
  AdminAssetConversationListResponse,
  AssetConversation,
  AssetConversationListResponse,
  AssetConversationMessageRequest,
  AssetConversationMessageResponse,
  AssetConversationMessagesResponse,
  AssetConversationResponse,
  AssetMessage,
  AssetConversationType
} from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireActiveUser, requireAdmin } from "../../http/auth";
import { HttpError, badRequest, notFound } from "../../http/errors";
import { readPagination, type PageQuery } from "../admin/pagination";
import type { AdminRepository } from "../admin/admin.repository";
import { readAdminDataScope } from "../admin/adminPrincipalScope";
import type { AssetsRepository } from "../assets/assets.repository";
import type { BidsRepository } from "../bids/bids.repository";
import { assertLocalMarketplaceTextAllowed, type ContentSafetyService } from "../contentSafety/contentSafety.service";
import type { PrincipalsRepository } from "../principals/principals.repository";
import { readUserSummary } from "../users/userSummary";
import type { UsersRepository } from "../users/users.repository";
import type { MessageHub } from "../../realtime/messageHub";
import type { AssetConversationsRepository } from "./assetConversations.repository";

type AdminConversationQuery = PageQuery & {
  principalId?: string;
  type?: string;
};

export function registerAssetConversationRoutes(
  app: FastifyInstance,
  deps: {
    admins: AdminRepository;
    assets: AssetsRepository;
    bids: BidsRepository;
    users: UsersRepository;
    principals: PrincipalsRepository;
    conversations: AssetConversationsRepository;
    contentSafety: ContentSafetyService;
    messageHub: Pick<MessageHub, "publish">;
  }
): void {
  app.post<{ Params: { assetId: string }; Reply: AssetConversationResponse }>(
    "/api/assets/:assetId/conversations/principal",
    { preHandler: requireActiveUser(deps.users) },
    async (request) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const asset = await deps.assets.findById(request.params.assetId);
      if (!asset) {
        throw notFound("asset_not_found", "Asset not found");
      }
      if (!asset.principalId) {
        throw badRequest("asset_principal_missing", "Asset does not have a principal");
      }
      const bids = await deps.bids.listByAsset(asset.id);
      const isParticipant = asset.sellerId === userId || bids.some((bid) => bid.bidderId === userId);
      if (!isParticipant) {
        throw new HttpError(403, "asset_conversation_not_allowed", "Only asset sellers or bidders can contact the principal");
      }
      const principal = await deps.principals.findById(asset.principalId);
      if (!principal) {
        throw badRequest("asset_principal_missing", "Asset does not have a principal");
      }
      const conversation = await deps.conversations.createOrGetPrincipalConversation({
        asset: {
          id: asset.id,
          title: asset.title,
          gameName: asset.gameName,
          serverName: asset.serverName,
          assetType: asset.assetType
        },
        user: await readUserSummary(deps.users, userId),
        principal: { id: principal.id, displayName: principal.displayName }
      });
      return { conversation };
    }
  );

  app.get<{ Querystring: PageQuery; Reply: AssetConversationListResponse }>(
    "/api/profile/asset-conversations",
    { preHandler: requireActiveUser(deps.users) },
    async (request) => {
      return deps.conversations.listForUser(request.user.id, readPagination(request.query));
    }
  );

  app.get<{ Params: { conversationId: string }; Querystring: PageQuery; Reply: AssetConversationMessagesResponse }>(
    "/api/profile/asset-conversations/:conversationId/messages",
    { preHandler: requireActiveUser(deps.users) },
    async (request) => {
      const conversation = await assertUserConversation(deps.conversations, request.params.conversationId, request.user.id);
      await deps.conversations.markRead(conversation.id, "user");
      return deps.conversations.listMessages(conversation.id, readPagination(request.query));
    }
  );

  app.post<{
    Params: { conversationId: string };
    Body: AssetConversationMessageRequest;
    Reply: AssetConversationMessageResponse;
  }>(
    "/api/profile/asset-conversations/:conversationId/messages",
    { preHandler: requireActiveUser(deps.users) },
    async (request) => {
      const conversation = await assertUserConversation(deps.conversations, request.params.conversationId, request.user.id);
      const content = readMessageContent(request.body);
      const user = await deps.users.findById(Number(request.user.id));
      if (!user) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      await deps.contentSafety.assertTextAllowed({ content, openid: user.openid });
      const result = await deps.conversations.createMessage({
        conversationId: conversation.id,
        senderType: "user",
        senderUserId: request.user.id,
        senderDisplayName: user.display_name,
        content
      });
      publishMessageEvents(deps.messageHub, result.conversation, result.message);
      return result;
    }
  );

  app.get<{ Querystring: AdminConversationQuery; Reply: AdminAssetConversationListResponse }>(
    "/admin/asset-conversations",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async (request) => {
      const scope = await readAdminDataScope(request, deps.principals);
      const { page, pageSize } = readPagination(request.query);
      if (scope === null) {
        return { items: [], total: 0, page, pageSize, hasMore: false, unreadCount: 0 };
      }
      const type = readConversationType(request.query.type);
      const principalId = scope.principalId ?? normalizeIdQuery(request.query.principalId);
      return deps.conversations.listForAdmin({ page, pageSize, principalId, type });
    }
  );

  app.get<{ Params: { conversationId: string }; Querystring: PageQuery; Reply: AssetConversationMessagesResponse }>(
    "/admin/asset-conversations/:conversationId/messages",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async (request) => {
      const conversation = await assertAdminConversation(deps.conversations, deps.principals, request, request.params.conversationId);
      await deps.conversations.markRead(conversation.id, "admin");
      return deps.conversations.listMessages(conversation.id, readPagination(request.query));
    }
  );

  app.post<{
    Params: { conversationId: string };
    Body: AssetConversationMessageRequest;
    Reply: AssetConversationMessageResponse;
  }>(
    "/admin/asset-conversations/:conversationId/messages",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async (request) => {
      const conversation = await assertAdminConversation(deps.conversations, deps.principals, request, request.params.conversationId);
      const content = readMessageContent(request.body);
      assertLocalMarketplaceTextAllowed(content);
      const admin = request.admin ? await deps.admins.findById(request.admin.id) : null;
      if (!request.admin || !admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const result = await deps.conversations.createMessage({
        conversationId: conversation.id,
        senderType: "admin",
        senderAdminId: String(request.admin.id),
        senderDisplayName: conversation.principal?.displayName ?? admin.username,
        content
      });
      publishMessageEvents(deps.messageHub, result.conversation, result.message);
      return result;
    }
  );
}

function readMessageContent(body: AssetConversationMessageRequest | undefined): string {
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 500) {
    throw badRequest("invalid_asset_message", "Message content must be between 1 and 500 characters");
  }
  return content;
}

function normalizeIdQuery(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  return value.trim();
}

function readConversationType(value: unknown): AssetConversationType | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (value === "principal_contact" || value === "seller_contact") {
    return value;
  }
  throw badRequest("invalid_asset_conversation_type", "Asset conversation type is invalid");
}

async function assertUserConversation(conversations: AssetConversationsRepository, conversationId: string, userId: string) {
  const conversation = await conversations.findById(conversationId);
  if (!conversation || conversation.userId !== userId) {
    throw notFound("asset_conversation_not_found", "Asset conversation not found");
  }
  return conversation;
}

async function assertAdminConversation(
  conversations: AssetConversationsRepository,
  principals: PrincipalsRepository,
  request: Parameters<typeof readAdminDataScope>[0],
  conversationId: string
) {
  const conversation = await conversations.findById(conversationId);
  if (!conversation) {
    throw notFound("asset_conversation_not_found", "Asset conversation not found");
  }
  const scope = await readAdminDataScope(request, principals);
  if (scope === null || (scope.principalId && conversation.principalId !== scope.principalId)) {
    throw notFound("asset_conversation_not_found", "Asset conversation not found");
  }
  return conversation;
}

function publishMessageEvents(
  hub: Pick<MessageHub, "publish">,
  conversation: AssetConversation,
  message: AssetMessage
) {
  const serverTime = new Date().toISOString();
  hub.publish({
    type: "asset_message_created",
    userId: conversation.userId,
    principalId: conversation.principalId,
    conversationId: conversation.id,
    message,
    serverTime
  });
  hub.publish({
    type: "asset_conversation_updated",
    userId: conversation.userId,
    principalId: conversation.principalId,
    conversation,
    serverTime
  });
}
