import type { AuctionWsEvent } from "@auction/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import { createInMemoryAssetsRepository } from "../../api/src/modules/assets/assets.repository";
import { createInMemoryBidsRepository } from "../../api/src/modules/bids/bids.repository";
import { createInMemoryUsersRepository } from "../../api/src/modules/users/users.repository";
import { AuctionHub } from "../../api/src/realtime/auctionHub";

const futureEndAt = (offsetMs = 24 * 60 * 60 * 1000) => new Date(Date.now() + offsetMs).toISOString();

async function login(app: ReturnType<typeof buildApp>, displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/mock-login",
    payload: { displayName }
  });
  return response.json().token as string;
}

async function wechatLogin(app: ReturnType<typeof buildApp>, code: string, displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/wechat-login",
    payload: { code, displayName }
  });
  return response.json().token as string;
}

async function reviewerToken(app: ReturnType<typeof buildApp>) {
  const response = await app.inject({
    method: "POST",
    url: "/admin/auth/login",
    payload: { username: "reviewer", password: "reviewer-pass" }
  });
  return response.json().token as string;
}

function assetPayload(overrides: Record<string, unknown> = {}) {
  return {
    gameName: "梦幻西游",
    serverName: "测试区",
    assetType: "角色",
    principalId: "1",
    title: "69级角色",
    description: "展示用资产",
    startingPriceCents: 10000,
    minIncrementCents: 100,
    originalEndAt: futureEndAt(),
    ...overrides
  };
}

async function createActiveAsset(app: ReturnType<typeof buildApp>, sellerToken: string, overrides: Record<string, unknown> = {}) {
  const created = await app.inject({
    method: "POST",
    url: "/api/assets",
    headers: { authorization: `Bearer ${sellerToken}` },
    payload: assetPayload(overrides)
  });
  const assetId = created.json().asset.id as string;
  const adminToken = await reviewerToken(app);
  await app.inject({
    method: "POST",
    url: `/admin/assets/${assetId}/approve`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  return assetId;
}

describe("bidding", () => {
  it("returns 400 for malformed bid payloads", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const bidderToken = await login(app, "买家");

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}`, "content-type": "application/json" },
        payload: "{"
      });

      expect(bid.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("accepts a valid bid on an active asset", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "买家");
      const assetId = await createActiveAsset(app, sellerToken);

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });

      expect(bid.statusCode).toBe(200);
      expect(bid.json()).toMatchObject({
        extended: false,
        bid: { assetId, amountCents: 10000, bidder: { displayName: "买家" } },
        asset: { id: assetId, currentPriceCents: 10000 }
      });
    } finally {
      await app.close();
    }
  });

  it("rejects bids until the buyer accepts the bid commitment", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "买家");
      const assetId = await createActiveAsset(app, sellerToken);

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000 }
      });

      expect(bid.statusCode).toBe(400);
      expect(bid.json().error).toMatchObject({
        code: "bid_commitment_required",
        message: "Bid commitment must be accepted"
      });
    } finally {
      await app.close();
    }
  });

  it("rejects bids from the current highest bidder", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "买家");
      const assetId = await createActiveAsset(app, sellerToken);

      const firstBid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });
      const repeatedBid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10100, commitmentAccepted: true }
      });

      expect(firstBid.statusCode).toBe(200);
      expect(repeatedBid.statusCode).toBe(400);
      expect(repeatedBid.json().error.code).toBe("bidder_already_highest");
    } finally {
      await app.close();
    }
  });

  it("rejects bids from banned users even with an existing token", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "买家");
      const assetId = await createActiveAsset(app, sellerToken);
      await users.banUser(2, "线下交易违约");

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });

      expect(bid.statusCode).toBe(403);
      expect(bid.json().error.code).toBe("user_banned");
    } finally {
      await app.close();
    }
  });

  it("rejects bids when the user credit score is 70 or below", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "买家");
      const assetId = await createActiveAsset(app, sellerToken);
      await users.deductCreditScore(2, 30);

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });

      expect(bid.statusCode).toBe(403);
      expect(bid.json().error).toMatchObject({
        code: "credit_score_too_low",
        message: "Credit score is too low for this action",
        details: { creditScore: 70, minimumExclusive: 70 }
      });
    } finally {
      await app.close();
    }
  });

  it("rejects seller bidding on own asset", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const sellerToken = await login(app, "卖家");
      const assetId = await createActiveAsset(app, sellerToken);

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });

      expect(bid.statusCode).toBe(403);
      expect(bid.json().error.code).toBe("seller_cannot_bid");
    } finally {
      await app.close();
    }
  });

  it("rejects bids below the minimum increment", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const sellerToken = await login(app, "卖家");
      const firstBidderToken = await login(app, "买家一");
      const secondBidderToken = await login(app, "买家二");
      const assetId = await createActiveAsset(app, sellerToken);

      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${firstBidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${secondBidderToken}` },
        payload: { assetId, amountCents: 10099, commitmentAccepted: true }
      });

      expect(bid.statusCode).toBe(400);
      expect(bid.json().error.code).toBe("bid_too_low");
    } finally {
      await app.close();
    }
  });

  it("rejects bidding after the auction has ended", async () => {
    const assets = createInMemoryAssetsRepository();
    const sellerId = "seller-ended";
    const asset = await assets.createPending({
      sellerId,
      ...assetPayload({ originalEndAt: new Date(Date.now() - 1000).toISOString() })
    });
    await assets.updateStatus(asset.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const bidderToken = await login(app, "买家");
      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId: asset.id, amountCents: 10000, commitmentAccepted: true }
      });

      expect(bid.statusCode).toBe(400);
      expect(bid.json().error.code).toBe("auction_ended");
    } finally {
      await app.close();
    }
  });

  it("extends and broadcasts bids placed near auction end", async () => {
    const events: AuctionWsEvent[] = [];
    const hub = { publish: (_assetId: string, event: AuctionWsEvent) => events.push(event) };
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets, hub } as Parameters<typeof buildApp>[0]);

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "买家");
      const asset = await assets.createPending({
        sellerId: "1",
        ...assetPayload({ originalEndAt: futureEndAt(60 * 1000) })
      });
      await assets.updateStatus(asset.id, "active");

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId: asset.id, amountCents: 10000, commitmentAccepted: true }
      });

      expect(bid.statusCode).toBe(200);
      expect(bid.json().extended).toBe(true);
      expect(new Date(bid.json().asset.effectiveEndAt).getTime()).toBeGreaterThan(
        new Date(bid.json().asset.originalEndAt).getTime()
      );
      expect(events.map((event) => event.type)).toEqual(["bid_accepted", "auction_extended"]);
      expect(events[0]).toMatchObject({
        type: "bid_accepted",
        bid: { bidder: { displayName: "买家" } }
      });
    } finally {
      await app.close();
    }
  });

  it("creates station notifications for prior bidders when another bidder wins the current price", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const sellerToken = await login(app, "卖家");
      const firstBidderToken = await login(app, "买家一");
      const secondBidderToken = await login(app, "买家二");
      const assetId = await createActiveAsset(app, sellerToken);

      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${firstBidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${secondBidderToken}` },
        payload: { assetId, amountCents: 10100, commitmentAccepted: true }
      });

      const firstBidderNotifications = await app.inject({
        method: "GET",
        url: "/api/profile/notifications",
        headers: { authorization: `Bearer ${firstBidderToken}` }
      });
      const secondBidderNotifications = await app.inject({
        method: "GET",
        url: "/api/profile/notifications",
        headers: { authorization: `Bearer ${secondBidderToken}` }
      });

      expect(firstBidderNotifications.statusCode).toBe(200);
      expect(firstBidderNotifications.json().unreadCount).toBe(1);
      expect(firstBidderNotifications.json().items).toEqual([
        expect.objectContaining({
          type: "outbid",
          assetId,
          actorDisplayName: "买家二",
          amountCents: 10100,
          readAt: null
        })
      ]);
      expect(secondBidderNotifications.json().unreadCount).toBe(0);
      expect(secondBidderNotifications.json().items).toEqual([]);

      const notificationId = firstBidderNotifications.json().items[0].id;
      const readResponse = await app.inject({
        method: "POST",
        url: `/api/profile/notifications/${notificationId}/read`,
        headers: { authorization: `Bearer ${firstBidderToken}` }
      });
      expect(readResponse.statusCode).toBe(200);
      expect(readResponse.json().notification.readAt).toEqual(expect.any(String));
    } finally {
      await app.close();
    }
  });

  it("sends a WeChat subscribe message to prior bidders when they are outbid", async () => {
    const sentMessages: unknown[] = [];
    const app = buildApp({
      enableMockAuth: false,
      wechatCodeSessionExchanger: async (code: string) => ({ openid: `openid-${code}` }),
      subscribeMessageService: {
        async sendPriceChange(input: unknown) {
          sentMessages.push(input);
        }
      }
    } as Parameters<typeof buildApp>[0]);

    try {
      const sellerToken = await wechatLogin(app, "seller", "卖家");
      const firstBidderToken = await wechatLogin(app, "first-bidder", "买家一");
      const secondBidderToken = await wechatLogin(app, "second-bidder", "买家二");
      const assetId = await createActiveAsset(app, sellerToken, { title: "订阅提醒资产" });

      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${firstBidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${secondBidderToken}` },
        payload: { assetId, amountCents: 10100, commitmentAccepted: true }
      });

      expect(response.statusCode).toBe(200);
      expect(sentMessages).toEqual([
        expect.objectContaining({
          touserOpenid: "openid-first-bidder",
          assetId,
          assetTitle: "订阅提醒资产",
          previousAmountCents: 10000,
          amountCents: 10100,
          actorDisplayName: "买家二"
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("keeps bid routes successful when WeChat subscribe message sending fails", async () => {
    const app = buildApp({
      enableMockAuth: false,
      wechatCodeSessionExchanger: async (code: string) => ({ openid: `openid-${code}` }),
      subscribeMessageService: {
        async sendPriceChange() {
          throw new Error("subscribe send failed");
        }
      }
    } as Parameters<typeof buildApp>[0]);

    try {
      const sellerToken = await wechatLogin(app, "seller", "卖家");
      const firstBidderToken = await wechatLogin(app, "first-bidder", "买家一");
      const secondBidderToken = await wechatLogin(app, "second-bidder", "买家二");
      const assetId = await createActiveAsset(app, sellerToken);

      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${firstBidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${secondBidderToken}` },
        payload: { assetId, amountCents: 10100, commitmentAccepted: true }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().bid).toMatchObject({ assetId, amountCents: 10100 });
    } finally {
      await app.close();
    }
  });

  it("rejects marking notifications read when the user credit score is 70 or below", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users });

    try {
      const sellerToken = await login(app, "卖家");
      const firstBidderToken = await login(app, "买家一");
      const secondBidderToken = await login(app, "买家二");
      const assetId = await createActiveAsset(app, sellerToken);

      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${firstBidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${secondBidderToken}` },
        payload: { assetId, amountCents: 10100, commitmentAccepted: true }
      });
      const notifications = await app.inject({
        method: "GET",
        url: "/api/profile/notifications",
        headers: { authorization: `Bearer ${firstBidderToken}` }
      });
      await users.deductCreditScore(2, 30);

      const readResponse = await app.inject({
        method: "POST",
        url: `/api/profile/notifications/${notifications.json().items[0].id}/read`,
        headers: { authorization: `Bearer ${firstBidderToken}` }
      });

      expect(readResponse.statusCode).toBe(403);
      expect(readResponse.json().error.code).toBe("credit_score_too_low");
    } finally {
      await app.close();
    }
  });

  it("keeps bid routes successful when notification creation fails", async () => {
    const app = buildApp({
      enableMockAuth: true,
      notificationsRepository: {
        async createMany() {
          throw new Error("notification table missing");
        },
        async listByUser() {
          return [];
        },
        async markRead() {
          return null;
        }
      }
    } as Parameters<typeof buildApp>[0]);

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "买家");
      const assetId = await createActiveAsset(app, sellerToken);

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });

      expect(bid.statusCode).toBe(200);
      expect(bid.json().bid).toMatchObject({ assetId, amountCents: 10000 });
    } finally {
      await app.close();
    }
  });

  it("keeps bid routes successful when one auction subscriber throws", async () => {
    const hub = new AuctionHub();
    const receivedEvents: AuctionWsEvent[] = [];
    const app = buildApp({ enableMockAuth: true, hub });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "买家");
      const assetId = await createActiveAsset(app, sellerToken);
      hub.subscribe(assetId, {
        send() {
          throw new Error("subscriber failed");
        }
      });
      hub.subscribe(assetId, {
        send(event) {
          receivedEvents.push(event);
        }
      });

      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });

      expect(bid.statusCode).toBe(200);
      expect(receivedEvents.map((event) => event.type)).toEqual(["bid_accepted"]);
    } finally {
      await app.close();
    }
  });

  it("does not keep in-memory bid records when asset persistence fails", async () => {
    const asset = await createInMemoryAssetsRepository().createPending({
      sellerId: "seller-repo",
      ...assetPayload()
    });
    const bids = createInMemoryBidsRepository(async () => {
      throw new Error("asset persistence failed");
    });

    await expect(
      bids.createBid({
        asset,
        bidderId: "bidder-repo",
        amountCents: 10000,
        effectiveEndAt: asset.effectiveEndAt
      })
    ).rejects.toThrow("asset persistence failed");

    await expect(bids.listByAsset(asset.id)).resolves.toEqual([]);
  });
});
