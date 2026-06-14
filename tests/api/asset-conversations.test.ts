import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import { HttpError } from "../../api/src/http/errors";
import { createInMemoryAssetsRepository, type AssetsRepository } from "../../api/src/modules/assets/assets.repository";
import type { ContentSafetyService } from "../../api/src/modules/contentSafety/contentSafety.service";
import { MessageHub } from "../../api/src/realtime/messageHub";

const futureEndAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

async function login(app: ReturnType<typeof buildApp>, displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/mock-login",
    payload: { displayName }
  });
  return response.json().token as string;
}

async function adminToken(app: ReturnType<typeof buildApp>, username: string, password: string) {
  const response = await app.inject({
    method: "POST",
    url: "/admin/auth/login",
    payload: { username, password }
  });
  return response.json().token as string;
}

async function createActiveAsset(assets: AssetsRepository, sellerId: string, overrides: Record<string, unknown> = {}) {
  const created = await assets.createPending({
    sellerId,
    principalId: "1",
    gameName: "塔防精灵",
    serverName: "测试区",
    assetType: "账号",
    title: "可沟通资产",
    description: "用于消息测试",
    startingPriceCents: 10000,
    minIncrementCents: 100,
    originalEndAt: futureEndAt(),
    ...overrides
  });
  return assets.updateStatus(created.id, "active");
}

async function createConversation(app: ReturnType<typeof buildApp>, token: string, assetId: string) {
  return app.inject({
    method: "POST",
    url: `/api/assets/${assetId}/conversations/principal`,
    headers: { authorization: `Bearer ${token}` }
  });
}

describe("asset conversations", () => {
  it("allows asset sellers and bidders to create principal contact conversations", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "出价用户");
      const strangerToken = await login(app, "路人");
      const asset = await createActiveAsset(assets, "1");
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId: asset.id, amountCents: 10000, commitmentAccepted: true }
      });

      const sellerConversation = await createConversation(app, sellerToken, asset.id);
      const bidderConversation = await createConversation(app, bidderToken, asset.id);
      const strangerConversation = await createConversation(app, strangerToken, asset.id);

      expect(sellerConversation.statusCode).toBe(200);
      expect(sellerConversation.json().conversation).toMatchObject({
        assetId: asset.id,
        conversationType: "principal_contact",
        userId: "1",
        principal: { id: "1", displayName: "默认主理人" },
        asset: { id: asset.id, title: "可沟通资产" }
      });
      expect(bidderConversation.statusCode).toBe(200);
      expect(bidderConversation.json().conversation).toMatchObject({
        assetId: asset.id,
        userId: "2"
      });
      expect(strangerConversation.statusCode).toBe(403);
      expect(strangerConversation.json().error.code).toBe("asset_conversation_not_allowed");
    } finally {
      await app.close();
    }
  });

  it("keeps user conversations private and updates unread state after user and admin messages", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const sellerToken = await login(app, "卖家");
      await login(app, "其他用户");
      const asset = await createActiveAsset(assets, "1");
      const conversation = await createConversation(app, sellerToken, asset.id);
      const conversationId = conversation.json().conversation.id;

      const userMessage = await app.inject({
        method: "POST",
        url: `/api/profile/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: { content: "我想咨询这个账号" }
      });
      const reviewerToken = await adminToken(app, "reviewer", "reviewer-pass");
      const adminList = await app.inject({
        method: "GET",
        url: "/admin/asset-conversations",
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      const adminMessages = await app.inject({
        method: "GET",
        url: `/admin/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      const adminReply = await app.inject({
        method: "POST",
        url: `/admin/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${reviewerToken}` },
        payload: { content: "主理人已收到，请稍等" }
      });
      const userList = await app.inject({
        method: "GET",
        url: "/api/profile/asset-conversations",
        headers: { authorization: `Bearer ${sellerToken}` }
      });

      expect(userMessage.statusCode).toBe(200);
      expect(userMessage.json().message).toMatchObject({
        conversationId,
        senderType: "user",
        senderDisplayName: "卖家",
        content: "我想咨询这个账号"
      });
      expect(adminList.statusCode).toBe(200);
      expect(adminList.json().items[0]).toMatchObject({
        id: conversationId,
        adminUnreadCount: 1,
        userUnreadCount: 0,
        lastMessageText: "我想咨询这个账号"
      });
      expect(adminMessages.statusCode).toBe(200);
      expect(adminMessages.json().items).toHaveLength(1);
      expect(adminReply.statusCode).toBe(200);
      expect(adminReply.json().message).toMatchObject({
        senderType: "admin",
        senderDisplayName: "默认主理人",
        content: "主理人已收到，请稍等"
      });
      expect(userList.statusCode).toBe(200);
      expect(userList.json()).toMatchObject({
        total: 1,
        unreadCount: 1,
        items: [expect.objectContaining({ id: conversationId, userUnreadCount: 1, adminUnreadCount: 0 })]
      });
    } finally {
      await app.close();
    }
  });

  it("does not send asset message subscribe reminders for principal contact conversations", async () => {
    const assets = createInMemoryAssetsRepository();
    const sentAssetMessages: unknown[] = [];
    const app = buildApp({
      enableMockAuth: true,
      assetsRepository: assets,
      subscribeMessageService: {
        async sendPriceChange() {},
        async sendAssetMessage(input) {
          sentAssetMessages.push(input);
        }
      }
    });

    try {
      const sellerToken = await login(app, "卖家");
      const asset = await createActiveAsset(assets, "1");
      const conversation = await createConversation(app, sellerToken, asset.id);
      const conversationId = conversation.json().conversation.id;
      const reviewerToken = await adminToken(app, "reviewer", "reviewer-pass");

      const userMessage = await app.inject({
        method: "POST",
        url: `/api/profile/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: { content: "我想咨询这个账号" }
      });
      const adminReply = await app.inject({
        method: "POST",
        url: `/admin/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${reviewerToken}` },
        payload: { content: "主理人已收到，请稍等" }
      });

      expect(userMessage.statusCode).toBe(200);
      expect(adminReply.statusCode).toBe(200);
      expect(sentAssetMessages).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it("lets users hide selected conversations without deleting them for admins or future replies", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const sellerToken = await login(app, "卖家");
      const asset = await createActiveAsset(assets, "1");
      const conversation = await createConversation(app, sellerToken, asset.id);
      const conversationId = conversation.json().conversation.id;
      const reviewerToken = await adminToken(app, "reviewer", "reviewer-pass");

      await app.inject({
        method: "POST",
        url: `/api/profile/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: { content: "我想问一下" }
      });

      const hidden = await app.inject({
        method: "POST",
        url: "/api/profile/asset-conversations/delete",
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: { ids: [conversationId] }
      });
      const userListAfterHide = await app.inject({
        method: "GET",
        url: "/api/profile/asset-conversations",
        headers: { authorization: `Bearer ${sellerToken}` }
      });
      const adminListAfterHide = await app.inject({
        method: "GET",
        url: "/admin/asset-conversations",
        headers: { authorization: `Bearer ${reviewerToken}` }
      });

      expect(hidden.statusCode).toBe(200);
      expect(hidden.json().items).toEqual([]);
      expect(userListAfterHide.json().items).toEqual([]);
      expect(adminListAfterHide.json().items).toEqual([expect.objectContaining({ id: conversationId })]);

      const adminReply = await app.inject({
        method: "POST",
        url: `/admin/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${reviewerToken}` },
        payload: { content: "可以沟通" }
      });
      const userListAfterReply = await app.inject({
        method: "GET",
        url: "/api/profile/asset-conversations",
        headers: { authorization: `Bearer ${sellerToken}` }
      });

      expect(adminReply.statusCode).toBe(200);
      expect(userListAfterReply.json().items).toEqual([expect.objectContaining({ id: conversationId, userUnreadCount: 1 })]);
    } finally {
      await app.close();
    }
  });

  it("scopes admin conversation lists by bound principal and lets super admins see all", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const firstSellerToken = await login(app, "一号卖家");
      const secondSellerToken = await login(app, "二号卖家");
      const firstAsset = await createActiveAsset(assets, "1", { title: "一号主理人资产", principalId: "1" });
      const secondAsset = await createActiveAsset(assets, "2", { title: "二号主理人资产", principalId: "2" });
      await createConversation(app, firstSellerToken, firstAsset.id);
      await createConversation(app, secondSellerToken, secondAsset.id);
      const reviewerToken = await adminToken(app, "reviewer", "reviewer-pass");
      const operatorToken = await adminToken(app, "operator", "operator-pass");
      const superToken = await adminToken(app, "super", "super-pass");

      const reviewerList = await app.inject({
        method: "GET",
        url: "/admin/asset-conversations",
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      const operatorList = await app.inject({
        method: "GET",
        url: "/admin/asset-conversations",
        headers: { authorization: `Bearer ${operatorToken}` }
      });
      const superList = await app.inject({
        method: "GET",
        url: "/admin/asset-conversations",
        headers: { authorization: `Bearer ${superToken}` }
      });
      const superFiltered = await app.inject({
        method: "GET",
        url: "/admin/asset-conversations?principalId=2",
        headers: { authorization: `Bearer ${superToken}` }
      });

      expect(reviewerList.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ asset: expect.objectContaining({ title: "一号主理人资产" }) })]
      });
      expect(operatorList.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ asset: expect.objectContaining({ title: "二号主理人资产" }) })]
      });
      expect(superList.json().total).toBe(2);
      expect(superFiltered.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ principal: expect.objectContaining({ id: "2" }) })]
      });
    } finally {
      await app.close();
    }
  });

  it("rejects invalid text and content safety failures before creating messages", async () => {
    const assets = createInMemoryAssetsRepository();
    const contentSafetyService: ContentSafetyService = {
      async assertTextAllowed(input) {
        if (input.content.includes("敏感")) {
          throw new HttpError(400, "content_safety_risky", "Content safety check failed");
        }
      },
      async requestImageCheck() {
        return { status: "pass" };
      },
      async assertImageUploadsAllowed() {},
      async assertAssetImagesAllowed() {}
    };
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets, contentSafetyService });

    try {
      const sellerToken = await login(app, "卖家");
      const asset = await createActiveAsset(assets, "1");
      const conversation = await createConversation(app, sellerToken, asset.id);
      const conversationId = conversation.json().conversation.id;

      const empty = await app.inject({
        method: "POST",
        url: `/api/profile/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: { content: "   " }
      });
      const tooLong = await app.inject({
        method: "POST",
        url: `/api/profile/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: { content: "a".repeat(501) }
      });
      const risky = await app.inject({
        method: "POST",
        url: `/api/profile/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: { content: "包含敏感内容" }
      });

      expect(empty.statusCode).toBe(400);
      expect(empty.json().error.code).toBe("invalid_asset_message");
      expect(tooLong.statusCode).toBe(400);
      expect(tooLong.json().error.code).toBe("invalid_asset_message");
      expect(risky.statusCode).toBe(400);
      expect(risky.json().error.code).toBe("content_safety_risky");
    } finally {
      await app.close();
    }
  });

  it("publishes message events only to the user, bound principal, and super admin subscribers", () => {
    const hub = new MessageHub();
    const userEvents: unknown[] = [];
    const principalEvents: unknown[] = [];
    const superEvents: unknown[] = [];
    const otherUserEvents: unknown[] = [];
    hub.subscribeUser("1", { send: (event) => userEvents.push(event) });
    hub.subscribeUser("2", { send: (event) => otherUserEvents.push(event) });
    hub.subscribePrincipal("1", { send: (event) => principalEvents.push(event) });
    hub.subscribeAllAdmins({ send: (event) => superEvents.push(event) });

    hub.publish({
      type: "asset_message_created",
      userId: "1",
      principalId: "1",
      targetUserId: null,
      conversationId: "9",
      message: {
        id: "3",
        conversationId: "9",
        senderType: "user",
        senderUserId: "1",
        senderAdminId: null,
        senderDisplayName: "卖家",
        content: "你好",
        createdAt: "2026-06-06T00:00:00.000Z"
      },
      serverTime: "2026-06-06T00:00:00.000Z"
    });

    expect(userEvents).toHaveLength(1);
    expect(principalEvents).toHaveLength(1);
    expect(superEvents).toHaveLength(1);
    expect(otherUserEvents).toHaveLength(0);
  });

  it("publishes seller contact message events only to the participating users", () => {
    const hub = new MessageHub();
    const requesterEvents: unknown[] = [];
    const publisherEvents: unknown[] = [];
    const principalEvents: unknown[] = [];
    const superEvents: unknown[] = [];
    hub.subscribeUser("1", { send: (event) => publisherEvents.push(event) });
    hub.subscribeUser("2", { send: (event) => requesterEvents.push(event) });
    hub.subscribePrincipal("1", { send: (event) => principalEvents.push(event) });
    hub.subscribeAllAdmins({ send: (event) => superEvents.push(event) });

    hub.publish({
      type: "asset_message_created",
      userId: "2",
      principalId: null,
      targetUserId: "1",
      conversationId: "9",
      message: {
        id: "3",
        conversationId: "9",
        senderType: "user",
        senderUserId: "2",
        senderAdminId: null,
        senderDisplayName: "联系方",
        content: "你好",
        createdAt: "2026-06-06T00:00:00.000Z"
      },
      serverTime: "2026-06-06T00:00:00.000Z"
    });

    expect(requesterEvents).toHaveLength(1);
    expect(publisherEvents).toHaveLength(1);
    expect(principalEvents).toHaveLength(0);
    expect(superEvents).toHaveLength(0);
  });
});
