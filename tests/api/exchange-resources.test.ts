import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import { HttpError } from "../../api/src/http/errors";
import { createInMemoryAssetConversationsRepository } from "../../api/src/modules/assetConversations/assetConversations.repository";
import type { ContentSafetyService } from "../../api/src/modules/contentSafety/contentSafety.service";
import { createInMemoryExchangeResourcesRepository } from "../../api/src/modules/exchangeResources/exchangeResources.repository";

function exchangePayload(overrides: Record<string, unknown> = {}) {
  return {
    gameName: "塔防精灵",
    serverName: "测试区",
    title: "紫色工程龙珠",
    dragonBallAmountCents: 120000,
    dragonBall: {
      profession: "工程",
      quality: "紫",
      attributes: "附加伤害+0%，无视冰甲+0%"
    },
    desiredExchange: "想换红色工程龙珠或同价值龙珠",
    description: "可接受同区沟通交换",
    image: {
      objectKey: "uploads/exchange-resources/1/dragon.jpg",
      publicUrl: "https://img.example.com/uploads/exchange-resources/1/dragon.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024
    },
    ...overrides
  };
}

async function login(app: ReturnType<typeof buildApp>, code: string, displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/wechat-login",
    payload: { code, displayName }
  });
  return response.json().token as string;
}

async function superToken(app: ReturnType<typeof buildApp>) {
  const response = await app.inject({
    method: "POST",
    url: "/admin/auth/login",
    payload: { username: "super", password: "super-pass" }
  });
  return response.json().token as string;
}

const passingContentSafety: ContentSafetyService = {
  async assertTextAllowed() {},
  async requestImageCheck() {
    return { status: "pass" };
  },
  async assertImageUploadsAllowed() {},
  async assertAssetImagesAllowed() {}
};

describe("exchange resources", () => {
  it("publishes dragon ball exchange resources after text safety and supports public/profile pagination", async () => {
    const checkedText: string[] = [];
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: {
        ...passingContentSafety,
        async assertTextAllowed(input) {
          checkedText.push(input.content);
        }
      },
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const token = await login(app, "publisher-code", "发布者");

      const context = await app.inject({
        method: "GET",
        url: "/api/exchange-resources/context?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(context.statusCode).toBe(200);
      expect(context.json()).toMatchObject({
        enabled: true,
        disabledReason: null,
        gameName: "塔防精灵",
        supportedItemCategories: ["龙珠"]
      });

      const created = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload()
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().resource).toMatchObject({
        publisherId: "1",
        gameName: "塔防精灵",
        serverName: "测试区",
        assetType: "道具",
        itemCategory: "龙珠",
        title: "紫色工程龙珠",
        dragonBallAmountCents: 120000,
        imageUrl: "https://img.example.com/uploads/exchange-resources/1/dragon.jpg",
        desiredExchange: "想换红色工程龙珠或同价值龙珠",
        status: "active",
        expiresAt: expect.any(String),
        dragonBall: {
          element: "魂",
          profession: "工程",
          quality: "紫",
          attributes: "附加伤害+0%，无视冰甲+0%"
        }
      });
      expect(checkedText.join("\n")).toContain("紫色工程龙珠");
      expect(checkedText.join("\n")).toContain("想换红色工程龙珠");

      const resourceId = created.json().resource.id;
      const list = await app.inject({
        method: "GET",
        url: "/api/exchange-resources?page=1&pageSize=1&dragonBallProfession=%E5%B7%A5%E7%A8%8B"
      });
      const detail = await app.inject({
        method: "GET",
        url: `/api/exchange-resources/${resourceId}`
      });
      const mine = await app.inject({
        method: "GET",
        url: "/api/profile/exchange-resources?page=1&pageSize=10",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject({
        total: 1,
        page: 1,
        pageSize: 1,
        hasMore: false,
        items: [expect.objectContaining({ id: resourceId, title: "紫色工程龙珠" })]
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().resource).toMatchObject({
        id: resourceId,
        imageUrl: "https://img.example.com/uploads/exchange-resources/1/dragon.jpg",
        dragonBallAmountCents: 120000,
        publisher: { id: "1", displayName: "发布者" }
      });
      expect(mine.statusCode).toBe(200);
      expect(mine.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ id: resourceId, status: "active" })]
      });
    } finally {
      await app.close();
    }
  });

  it("allows publishing exchange resources without server name, description, or reference amount", async () => {
    const checkedText: string[] = [];
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: {
        ...passingContentSafety,
        async assertTextAllowed(input) {
          checkedText.push(input.content);
        }
      },
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const token = await login(app, "publisher-code", "发布者");
      const created = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload({ serverName: "", description: "", dragonBallAmountCents: null })
      });

      expect(created.statusCode).toBe(200);
      expect(created.json().resource).toMatchObject({
        serverName: "",
        description: "",
        dragonBallAmountCents: null,
        status: "active"
      });
      expect(checkedText.join("\n")).toContain("紫色工程龙珠");
    } finally {
      await app.close();
    }
  });

  it("rejects invalid reference amounts and missing or invalid exchange images", async () => {
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: passingContentSafety,
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const token = await login(app, "publisher-code", "发布者");
      const invalidAmount = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload({ dragonBallAmountCents: -1 })
      });
      const missingImage = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload({ image: undefined })
      });
      const multipleImages = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload({
          image: [
            {
              objectKey: "uploads/exchange-resources/1/a.jpg",
              publicUrl: "https://img.example.com/uploads/exchange-resources/1/a.jpg",
              mimeType: "image/jpeg",
              sizeBytes: 1024
            },
            {
              objectKey: "uploads/exchange-resources/1/b.jpg",
              publicUrl: "https://img.example.com/uploads/exchange-resources/1/b.jpg",
              mimeType: "image/jpeg",
              sizeBytes: 1024
            }
          ]
        })
      });

      expect(invalidAmount.statusCode).toBe(400);
      expect(invalidAmount.json().error.code).toBe("invalid_exchange_resource");
      expect(missingImage.statusCode).toBe(400);
      expect(missingImage.json().error.code).toBe("invalid_exchange_resource_image");
      expect(multipleImages.statusCode).toBe(400);
      expect(multipleImages.json().error.code).toBe("invalid_exchange_resource_image");
    } finally {
      await app.close();
    }
  });

  it("keeps exchange resources private until the required image safety check passes", async () => {
    let imageStatus: "pending" | "pass" = "pending";
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: {
        ...passingContentSafety,
        async readImageUploadSafetyStatuses() {
          return [imageStatus];
        }
      },
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const token = await login(app, "publisher-code", "发布者");
      const created = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload()
      });
      const resourceId = created.json().resource.id;

      const hiddenList = await app.inject({ method: "GET", url: "/api/exchange-resources" });
      const hiddenDetail = await app.inject({ method: "GET", url: `/api/exchange-resources/${resourceId}` });
      const minePending = await app.inject({
        method: "GET",
        url: "/api/profile/exchange-resources",
        headers: { authorization: `Bearer ${token}` }
      });

      imageStatus = "pass";
      const publicList = await app.inject({ method: "GET", url: "/api/exchange-resources" });
      const publicDetail = await app.inject({ method: "GET", url: `/api/exchange-resources/${resourceId}` });

      expect(created.statusCode).toBe(200);
      expect(created.json().resource).toMatchObject({ status: "pending_image_review" });
      expect(hiddenList.json()).toMatchObject({ total: 0, items: [] });
      expect(hiddenDetail.statusCode).toBe(404);
      expect(minePending.json().items[0]).toMatchObject({ id: resourceId, status: "pending_image_review" });
      expect(publicList.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ id: resourceId, status: "active" })]
      });
      expect(publicDetail.statusCode).toBe(200);
      expect(publicDetail.json().resource).toMatchObject({ id: resourceId, status: "active" });
    } finally {
      await app.close();
    }
  });

  it("soft-expires exchange resources after 30 days while keeping profile and admin history visible", async () => {
    let timestamp = new Date("2026-06-01T00:00:00.000Z");
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: passingContentSafety,
      exchangeResourcesRepository: createInMemoryExchangeResourcesRepository({ now: () => timestamp }),
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const publisherToken = await login(app, "publisher-code", "发布者");
      const created = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${publisherToken}` },
        payload: exchangePayload()
      });
      const resourceId = created.json().resource.id;

      timestamp = new Date("2026-07-02T00:00:00.000Z");
      const publicList = await app.inject({ method: "GET", url: "/api/exchange-resources" });
      const publicDetail = await app.inject({ method: "GET", url: `/api/exchange-resources/${resourceId}` });
      const mine = await app.inject({
        method: "GET",
        url: "/api/profile/exchange-resources",
        headers: { authorization: `Bearer ${publisherToken}` }
      });
      const adminToken = await superToken(app);
      const adminList = await app.inject({
        method: "GET",
        url: "/admin/exchange-resources?status=expired",
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(created.statusCode).toBe(200);
      expect(created.json().resource.expiresAt).toBe("2026-07-01T00:00:00.000Z");
      expect(publicList.json()).toMatchObject({ total: 0, items: [] });
      expect(publicDetail.statusCode).toBe(404);
      expect(mine.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ id: resourceId, status: "expired" })]
      });
      expect(adminList.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ id: resourceId, status: "expired" })]
      });
    } finally {
      await app.close();
    }
  });

  it("orders profile exchange resources by publish time descending after status updates", async () => {
    let timestamp = new Date("2026-06-01T10:00:00.000Z");
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: passingContentSafety,
      exchangeResourcesRepository: createInMemoryExchangeResourcesRepository({ now: () => timestamp }),
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const token = await login(app, "publisher-code", "发布者");
      const oldCreated = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload({ title: "先发布的龙珠" })
      });
      expect(oldCreated.statusCode).toBe(200);

      timestamp = new Date("2026-06-02T10:00:00.000Z");
      const newCreated = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload({ title: "后发布的龙珠" })
      });
      expect(newCreated.statusCode).toBe(200);

      timestamp = new Date("2026-06-03T10:00:00.000Z");
      const closed = await app.inject({
        method: "POST",
        url: `/api/profile/exchange-resources/${oldCreated.json().resource.id}/close`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(closed.statusCode).toBe(200);

      const mine = await app.inject({
        method: "GET",
        url: "/api/profile/exchange-resources?page=1&pageSize=10",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(mine.statusCode).toBe(200);
      expect(mine.json().items.map((resource: { id: string }) => resource.id)).toEqual([
        newCreated.json().resource.id,
        oldCreated.json().resource.id
      ]);
    } finally {
      await app.close();
    }
  });

  it("lets admins page and filter exchange resources across statuses", async () => {
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: passingContentSafety,
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const publisherToken = await login(app, "publisher-code", "发布者");
      const activeCreated = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${publisherToken}` },
        payload: exchangePayload({ title: "还在展示的龙珠" })
      });
      const closedCreated = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${publisherToken}` },
        payload: exchangePayload({ title: "已经关闭的龙珠", desiredExchange: "想换红色战士龙珠" })
      });
      const closed = await app.inject({
        method: "POST",
        url: `/api/profile/exchange-resources/${closedCreated.json().resource.id}/close`,
        headers: { authorization: `Bearer ${publisherToken}` }
      });
      const adminToken = await superToken(app);

      const list = await app.inject({
        method: "GET",
        url: "/admin/exchange-resources?page=1&pageSize=10",
        headers: { authorization: `Bearer ${adminToken}` }
      });
      const closedList = await app.inject({
        method: "GET",
        url: "/admin/exchange-resources?status=closed",
        headers: { authorization: `Bearer ${adminToken}` }
      });
      const rejected = await app.inject({
        method: "GET",
        url: "/admin/exchange-resources"
      });

      expect(activeCreated.statusCode).toBe(200);
      expect(closed.statusCode).toBe(200);
      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject({
        total: 2,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: activeCreated.json().resource.id,
            status: "active",
            publisher: expect.objectContaining({ displayName: "发布者" })
          }),
          expect.objectContaining({
            id: closedCreated.json().resource.id,
            status: "closed",
            publisher: expect.objectContaining({ displayName: "发布者" })
          })
        ])
      });
      expect(closedList.statusCode).toBe(200);
      expect(closedList.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ id: closedCreated.json().resource.id, status: "closed" })]
      });
      expect(rejected.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("blocks exchange publishing when disabled and rejects invalid or risky text", async () => {
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: {
        ...passingContentSafety,
        async assertTextAllowed(input) {
          if (input.content.includes("敏感")) {
            throw new HttpError(400, "content_safety_risky", "Content safety check failed");
          }
        }
      },
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const token = await login(app, "publisher-code", "发布者");

      const invalid = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload({ dragonBall: { profession: "刺客", quality: "紫", attributes: "附加伤害+0%" } })
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.code).toBe("invalid_exchange_resource");

      const risky = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload({ description: "包含敏感内容" })
      });
      expect(risky.statusCode).toBe(400);
      expect(risky.json().error.code).toBe("content_safety_risky");

      const admin = await superToken(app);
      const disabled = await app.inject({
        method: "POST",
        url: "/admin/configs/free_exchange_publish_enabled",
        headers: { authorization: `Bearer ${admin}` },
        payload: { value: "false" }
      });
      expect(disabled.statusCode).toBe(200);

      const context = await app.inject({
        method: "GET",
        url: "/api/exchange-resources/context",
        headers: { authorization: `Bearer ${token}` }
      });
      const publicContext = await app.inject({
        method: "GET",
        url: "/api/exchange-resources/context"
      });
      const created = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${token}` },
        payload: exchangePayload()
      });

      expect(context.json()).toMatchObject({
        enabled: false,
        disabledReason: "暂未开放自由交换发布"
      });
      expect(publicContext.statusCode).toBe(200);
      expect(publicContext.json()).toMatchObject({
        enabled: false,
        disabledReason: "暂未开放自由交换发布"
      });
      expect(created.statusCode).toBe(403);
      expect(created.json().error.code).toBe("exchange_publish_disabled");
    } finally {
      await app.close();
    }
  });

  it("lets non-publishers create seller conversations and sends non-blocking subscribe reminders", async () => {
    const sentMessages: Array<{ touserOpenid: string | null; conversationId: string; recipientUserId: string; senderDisplayName: string }> = [];
    let conversationTimeOffset = 0;
    const conversationTimeBase = Date.parse("2026-06-01T00:00:00.000Z");
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: passingContentSafety,
      assetConversationsRepository: createInMemoryAssetConversationsRepository({
        now: () => new Date(conversationTimeBase + conversationTimeOffset++ * 1000)
      }),
      subscribeMessageService: {
        async sendPriceChange() {},
        async sendAssetMessage(input) {
          sentMessages.push(input);
          if (input.senderDisplayName === "发布者") {
            throw new Error("subscribe send failed");
          }
        }
      } as unknown as Parameters<typeof buildApp>[0]["subscribeMessageService"],
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const publisherToken = await login(app, "publisher-code", "发布者");
      const buyerToken = await login(app, "buyer-code", "联系方");
      const created = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${publisherToken}` },
        payload: exchangePayload()
      });
      const resourceId = created.json().resource.id;

      const ownerConversation = await app.inject({
        method: "POST",
        url: `/api/exchange-resources/${resourceId}/conversations/seller`,
        headers: { authorization: `Bearer ${publisherToken}` }
      });
      expect(ownerConversation.statusCode).toBe(403);
      expect(ownerConversation.json().error).toMatchObject({
        code: "seller_conversation_not_allowed",
        message: "这是你发布的资源，不能联系自己"
      });

      const conversationResponse = await app.inject({
        method: "POST",
        url: `/api/exchange-resources/${resourceId}/conversations/seller`,
        headers: { authorization: `Bearer ${buyerToken}` }
      });
      expect(conversationResponse.statusCode).toBe(200);
      expect(conversationResponse.json().conversation).toMatchObject({
        conversationType: "seller_contact",
        assetSource: "exchange_resource",
        assetId: resourceId,
        userId: "2",
        targetUserId: "1",
        targetUser: { id: "1", displayName: "发布者" },
        principalId: null
      });
      const conversationId = conversationResponse.json().conversation.id;

      const buyerMessage = await app.inject({
        method: "POST",
        url: `/api/profile/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { content: "你好，我想交换这个龙珠" }
      });
      const publisherList = await app.inject({
        method: "GET",
        url: "/api/profile/asset-conversations",
        headers: { authorization: `Bearer ${publisherToken}` }
      });
      const publisherReply = await app.inject({
        method: "POST",
        url: `/api/profile/asset-conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${publisherToken}` },
        payload: { content: "可以，先说下你的资源" }
      });
      const buyerList = await app.inject({
        method: "GET",
        url: "/api/profile/asset-conversations",
        headers: { authorization: `Bearer ${buyerToken}` }
      });

      expect(buyerMessage.statusCode).toBe(200);
      expect(publisherList.json()).toMatchObject({
        total: 1,
        unreadCount: 1,
        items: [expect.objectContaining({ id: conversationId, userUnreadCount: 1 })]
      });
      expect(publisherReply.statusCode).toBe(200);
      expect(buyerList.json()).toMatchObject({
        total: 1,
        unreadCount: 1,
        items: [expect.objectContaining({ id: conversationId, userUnreadCount: 1 })]
      });
      expect(sentMessages).toEqual([
        expect.objectContaining({
          touserOpenid: "openid-publisher-code",
          recipientUserId: "1",
          senderDisplayName: "联系方",
          conversationId
        }),
        expect.objectContaining({
          touserOpenid: "openid-buyer-code",
          recipientUserId: "2",
          senderDisplayName: "发布者",
          conversationId
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("allows publishers to close their exchange resources and hides closed resources publicly", async () => {
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: passingContentSafety,
      wechatCodeSessionExchanger: async (code) => ({ openid: `openid-${code}` })
    });

    try {
      const publisherToken = await login(app, "publisher-code", "发布者");
      const otherToken = await login(app, "other-code", "其他用户");
      const created = await app.inject({
        method: "POST",
        url: "/api/exchange-resources",
        headers: { authorization: `Bearer ${publisherToken}` },
        payload: exchangePayload()
      });
      const resourceId = created.json().resource.id;

      const rejected = await app.inject({
        method: "POST",
        url: `/api/profile/exchange-resources/${resourceId}/close`,
        headers: { authorization: `Bearer ${otherToken}` }
      });
      expect(rejected.statusCode).toBe(404);

      const closed = await app.inject({
        method: "POST",
        url: `/api/profile/exchange-resources/${resourceId}/close`,
        headers: { authorization: `Bearer ${publisherToken}` }
      });
      const list = await app.inject({
        method: "GET",
        url: "/api/exchange-resources"
      });
      const mine = await app.inject({
        method: "GET",
        url: "/api/profile/exchange-resources",
        headers: { authorization: `Bearer ${publisherToken}` }
      });

      expect(closed.statusCode).toBe(200);
      expect(closed.json().resource).toMatchObject({ id: resourceId, status: "closed" });
      expect(list.json()).toMatchObject({ total: 0, items: [] });
      expect(mine.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ id: resourceId, status: "closed" })]
      });
    } finally {
      await app.close();
    }
  });
});
