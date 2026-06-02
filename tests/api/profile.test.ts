import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import { createInMemoryAssetsRepository, DEFAULT_ASSET_END_AT } from "../../api/src/modules/assets/assets.repository";
import { createInMemoryUsersRepository } from "../../api/src/modules/users/users.repository";

const futureEndAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

async function login(app: ReturnType<typeof buildApp>, displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/mock-login",
    payload: { displayName }
  });
  return response.json().token as string;
}

async function adminToken(app: ReturnType<typeof buildApp>) {
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
    sellerGameId: "seller-game-test",
    title: "69级角色",
    description: "展示用资产",
    startingPriceCents: 10000,
    minIncrementCents: 100,
    originalEndAt: futureEndAt(),
    ...overrides
  };
}

async function createAsset(app: ReturnType<typeof buildApp>, sellerToken: string, overrides: Record<string, unknown> = {}) {
  expect(sellerToken).toEqual(expect.any(String));
  const reviewer = await adminToken(app);
  const response = await app.inject({
    method: "POST",
    url: "/admin/assets",
    headers: { authorization: `Bearer ${reviewer}` },
    payload: {
      ...assetPayload(overrides),
      endAt: futureEndAt(),
      images: []
    }
  });
  expect(response.statusCode).toBe(200);
  return response.json().asset as { id: string };
}

async function approveAsset(_app: ReturnType<typeof buildApp>, _assetId: string) {
  return;
}

describe("profile routes", () => {
  it("degrades notifications to an empty list when storage is unavailable", async () => {
    const app = buildApp({
      enableMockAuth: true,
      notificationsRepository: {
        async createMany() {
          return [];
        },
        async listByUser() {
          throw new Error("notification table missing");
        },
        async markRead() {
          return null;
        }
      }
    } as Parameters<typeof buildApp>[0]);

    try {
      const token = await login(app, "买家");
      const response = await app.inject({
        method: "GET",
        url: "/api/profile/notifications",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ items: [], unreadCount: 0 });
    } finally {
      await app.close();
    }
  });

  it("disables miniapp user published asset records", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const seller = await login(app, "卖家");

      const response = await app.inject({
        method: "GET",
        url: "/api/profile/assets",
        headers: { authorization: `Bearer ${seller}` }
      });

      expect(response.statusCode).toBe(410);
      expect(response.json().error.code).toBe("user_asset_records_disabled");
    } finally {
      await app.close();
    }
  });

  it("still normalizes stale default deadlines inside the asset repository", async () => {
    const assets = createInMemoryAssetsRepository();
    const staleAsset = await assets.createPending({
      sellerId: "1",
      principalId: "1",
      gameName: "塔防精灵",
      serverName: "17区",
      assetType: "道具",
      title: "旧数据龙珠",
      description: "审核后截止时间旧数据",
      startingPriceCents: 10000,
      minIncrementCents: 100,
      originalEndAt: DEFAULT_ASSET_END_AT
    });
    const beforeActivate = Date.now();
    await assets.save({ ...staleAsset, status: "active", effectiveEndAt: DEFAULT_ASSET_END_AT });
    const afterActivate = Date.now();

    const [asset] = await assets.listBySeller("1");

    const effectiveEndAt = new Date(asset.effectiveEndAt).getTime();
    expect(effectiveEndAt).toBeGreaterThanOrEqual(beforeActivate + 24 * 60 * 60 * 1000);
    expect(effectiveEndAt).toBeLessThanOrEqual(afterActivate + 24 * 60 * 60 * 1000);
  });

  it("follows active assets, marks public lists, paginates follows, and unfollows", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const seller = await login(app, "卖家");
      const follower = await login(app, "关注用户");
      const firstAsset = await createAsset(app, seller, { title: "第一条可关注" });
      const secondAsset = await createAsset(app, seller, { title: "第二条可关注" });
      await approveAsset(app, firstAsset.id);
      await approveAsset(app, secondAsset.id);

      const firstFollow = await app.inject({
        method: "POST",
        url: `/api/assets/${firstAsset.id}/follow`,
        headers: { authorization: `Bearer ${follower}` }
      });
      const secondFollow = await app.inject({
        method: "POST",
        url: `/api/assets/${secondAsset.id}/follow`,
        headers: { authorization: `Bearer ${follower}` }
      });

      expect(firstFollow.statusCode).toBe(200);
      expect(firstFollow.json()).toMatchObject({ assetId: firstAsset.id, followed: true });
      expect(secondFollow.statusCode).toBe(200);

      const publicList = await app.inject({
        method: "GET",
        url: "/api/assets?page=1&pageSize=20",
        headers: { authorization: `Bearer ${follower}` }
      });
      expect(publicList.statusCode).toBe(200);
      expect(publicList.json().items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: firstAsset.id, followedByMe: true }),
          expect.objectContaining({ id: secondAsset.id, followedByMe: true })
        ])
      );

      const firstPage = await app.inject({
        method: "GET",
        url: "/api/profile/follows?page=1&pageSize=1",
        headers: { authorization: `Bearer ${follower}` }
      });
      const secondPage = await app.inject({
        method: "GET",
        url: "/api/profile/follows?page=2&pageSize=1",
        headers: { authorization: `Bearer ${follower}` }
      });

      expect(firstPage.statusCode).toBe(200);
      expect(firstPage.json()).toMatchObject({ total: 2, page: 1, pageSize: 1, hasMore: true });
      expect(firstPage.json().items).toHaveLength(1);
      expect(firstPage.json().items[0]).toMatchObject({ followedByMe: true });
      expect(secondPage.statusCode).toBe(200);
      expect(secondPage.json()).toMatchObject({ total: 2, page: 2, pageSize: 1, hasMore: false });
      expect(secondPage.json().items).toHaveLength(1);

      const unfollow = await app.inject({
        method: "POST",
        url: `/api/assets/${firstAsset.id}/unfollow`,
        headers: { authorization: `Bearer ${follower}` }
      });
      expect(unfollow.statusCode).toBe(200);
      expect(unfollow.json()).toEqual({ assetId: firstAsset.id, followed: false });

      const afterUnfollow = await app.inject({
        method: "GET",
        url: "/api/profile/follows?page=1&pageSize=20",
        headers: { authorization: `Bearer ${follower}` }
      });
      expect(afterUnfollow.json().items).toEqual([expect.objectContaining({ id: secondAsset.id, followedByMe: true })]);
    } finally {
      await app.close();
    }
  });

  it("does not allow following hidden pending assets by id", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const seller = await login(app, "卖家");
      const follower = await login(app, "关注用户");
      expect(seller).toEqual(expect.any(String));
      const asset = await assets.createPending({ ...assetPayload({ title: "待审核不可关注" }), sellerId: "1" });

      const response = await app.inject({
        method: "POST",
        url: `/api/assets/${asset.id}/follow`,
        headers: { authorization: `Bearer ${follower}` }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("asset_not_followable");
    } finally {
      await app.close();
    }
  });

  it("rejects follow and unfollow writes when the user credit score is 70 or below while browse remains available", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users });

    try {
      const seller = await login(app, "卖家");
      const follower = await login(app, "关注用户");
      const asset = await createAsset(app, seller, { title: "可浏览资产" });
      await approveAsset(app, asset.id);
      await users.deductCreditScore(2, 30);

      const list = await app.inject({
        method: "GET",
        url: "/api/assets?page=1&pageSize=20",
        headers: { authorization: `Bearer ${follower}` }
      });
      const detail = await app.inject({
        method: "GET",
        url: `/api/assets/${asset.id}`,
        headers: { authorization: `Bearer ${follower}` }
      });
      const follow = await app.inject({
        method: "POST",
        url: `/api/assets/${asset.id}/follow`,
        headers: { authorization: `Bearer ${follower}` }
      });
      const unfollow = await app.inject({
        method: "POST",
        url: `/api/assets/${asset.id}/unfollow`,
        headers: { authorization: `Bearer ${follower}` }
      });

      expect(list.statusCode).toBe(200);
      expect(detail.statusCode).toBe(200);
      expect(follow.statusCode).toBe(403);
      expect(follow.json().error).toMatchObject({
        code: "credit_score_too_low",
        message: "Credit score is too low for this action",
        details: { creditScore: 70, minimumExclusive: 70 }
      });
      expect(unfollow.statusCode).toBe(403);
      expect(unfollow.json().error.code).toBe("credit_score_too_low");
    } finally {
      await app.close();
    }
  });

  it("lists the current user's bid records with asset summaries", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const seller = await login(app, "卖家");
      const bidder = await login(app, "买家");
      const asset = await createAsset(app, seller, { title: "可竞价资产" });
      await approveAsset(app, asset.id);
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidder}` },
        payload: { assetId: asset.id, amountCents: 10000, commitmentAccepted: true }
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/profile/bids",
        headers: { authorization: `Bearer ${bidder}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([
        expect.objectContaining({
          amountCents: 10000,
          asset: expect.objectContaining({ id: asset.id, title: "可竞价资产" })
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("lists only finished assets won by the current highest bidder with pagination and asset names", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const seller = await login(app, "卖家");
      const loser = await login(app, "被超过的出价者");
      const bidder = await login(app, "最终最高出价者");
      const soldAsset = await createAsset(app, seller, { title: "已成交资产" });
      await approveAsset(app, soldAsset.id);
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidder}` },
        payload: { assetId: soldAsset.id, amountCents: 10000, commitmentAccepted: true }
      });
      await assets.updateStatus(soldAsset.id, "ended");
      const newerSoldAsset = await createAsset(app, seller, { title: "第二个成交资产" });
      await approveAsset(app, newerSoldAsset.id);
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${loser}` },
        payload: { assetId: newerSoldAsset.id, amountCents: 10000, commitmentAccepted: true }
      });
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidder}` },
        payload: { assetId: newerSoldAsset.id, amountCents: 10100, commitmentAccepted: true }
      });
      await assets.updateStatus(newerSoldAsset.id, "ended");
      const activeAsset = await createAsset(app, seller, { title: "仍在进行的当前最高价" });
      await approveAsset(app, activeAsset.id);
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidder}` },
        payload: { assetId: activeAsset.id, amountCents: 10000, commitmentAccepted: true }
      });

      const sellerResults = await app.inject({
        method: "GET",
        url: "/api/profile/results?page=1&pageSize=1",
        headers: { authorization: `Bearer ${seller}` }
      });
      const loserResults = await app.inject({
        method: "GET",
        url: "/api/profile/results",
        headers: { authorization: `Bearer ${loser}` }
      });
      const firstBidderPage = await app.inject({
        method: "GET",
        url: "/api/profile/results?page=1&pageSize=1",
        headers: { authorization: `Bearer ${bidder}` }
      });
      const bidderResults = await app.inject({
        method: "GET",
        url: "/api/profile/results?page=2&pageSize=1",
        headers: { authorization: `Bearer ${bidder}` }
      });

      expect(sellerResults.statusCode).toBe(200);
      expect(sellerResults.json()).toMatchObject({ total: 0, page: 1, pageSize: 1, hasMore: false });
      expect(loserResults.statusCode).toBe(200);
      expect(loserResults.json()).toMatchObject({ total: 0, items: [] });
      expect(firstBidderPage.statusCode).toBe(200);
      expect(firstBidderPage.json()).toMatchObject({ total: 2, page: 1, pageSize: 1, hasMore: true });
      expect(firstBidderPage.json().items).toEqual([
        expect.objectContaining({
          assetId: newerSoldAsset.id,
          status: "sold",
          finalPriceCents: 10100,
          asset: expect.objectContaining({ id: newerSoldAsset.id, title: "第二个成交资产" })
        })
      ]);
      expect(bidderResults.json()).toMatchObject({ total: 2, page: 2, pageSize: 1, hasMore: false });
      expect(bidderResults.json().items).toEqual([
        expect.objectContaining({
          assetId: soldAsset.id,
          status: "sold",
          finalPriceCents: 10000,
          asset: expect.objectContaining({ id: soldAsset.id, title: "已成交资产" })
        })
      ]);
    } finally {
      await app.close();
    }
  });
});
