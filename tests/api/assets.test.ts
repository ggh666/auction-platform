import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import { HttpError } from "../../api/src/http/errors";
import {
  createInMemoryAssetsRepository,
  type AssetsRepository
} from "../../api/src/modules/assets/assets.repository";
import type { ContentSafetyService, ImageSafetyInput } from "../../api/src/modules/contentSafety/contentSafety.service";
import type { ImageStorage } from "../../api/src/modules/images/r2Storage";
import { validateImageUpload } from "../../api/src/modules/images/images.service";

const futureEndAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function validAssetPayload(overrides: Record<string, unknown> = {}) {
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

async function login(app: ReturnType<typeof buildApp>, displayName = "卖家") {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/mock-login",
    payload: { displayName }
  });
  return response.json().token as string;
}

async function wechatLogin(app: ReturnType<typeof buildApp>, code = "seller-code", displayName = "卖家") {
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

async function createPendingRepositoryAsset(assets: AssetsRepository, overrides: Record<string, unknown> = {}) {
  return assets.createPending({
    sellerId: "1",
    ...validAssetPayload(overrides)
  });
}

async function createActiveRepositoryAsset(assets: AssetsRepository, overrides: Record<string, unknown> = {}) {
  const asset = await createPendingRepositoryAsset(assets, overrides);
  return assets.updateStatus(asset.id, "active");
}

describe("asset workflow", () => {
  function fakeImageStorage(): ImageStorage {
    return {
      async putImage(input) {
        return {
          objectKey: input.objectKey,
          publicUrl: `https://img.example.com/${input.objectKey}`
        };
      },
      async getImage() {
        return null;
      }
    };
  }

  it("allows miniapp users to publish pending assets while the publish switch is enabled", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const context = await app.inject({
        method: "GET",
        url: "/api/asset-publish-context",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(context.statusCode).toBe(200);
      expect(context.json()).toMatchObject({
        enabled: true,
        remainingDailyPublishCount: 3,
        defaultMinIncrementCents: 100,
        imagePolicy: { maxImagesPerAsset: 9, maxImageSizeBytes: 5242880 },
        principals: expect.arrayContaining([expect.objectContaining({ id: "1", displayName: "默认主理人" })])
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({
        sellerId: "1",
        principalId: "1",
        title: "69级角色",
        status: "pending_review"
      });
    } finally {
      await app.close();
    }
  });

  it("blocks miniapp publishing and image uploads while the publish switch is disabled", async () => {
    const app = buildApp({ enableMockAuth: true, imageStorage: fakeImageStorage() });

    try {
      const token = await login(app);
      const superToken = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "super", password: "super-pass" }
      });
      const config = await app.inject({
        method: "POST",
        url: "/admin/configs/user_asset_publish_enabled",
        headers: { authorization: `Bearer ${superToken.json().token}` },
        payload: { value: "false" }
      });
      expect(config.statusCode).toBe(200);

      const context = await app.inject({
        method: "GET",
        url: "/api/asset-publish-context",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(context.statusCode).toBe(200);
      expect(context.json()).toMatchObject({
        enabled: false,
        disabledReason: "暂未开放用户提交资产"
      });

      const created = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });
      expect(created.statusCode).toBe(403);
      expect(created.json().error.code).toBe("asset_publish_disabled");

      const response = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          assetType: "账号",
          mimeType: "image/jpeg",
          base64Data: Buffer.from("image").toString("base64")
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("asset_publish_disabled");
    } finally {
      await app.close();
    }
  });

  it("allows miniapp users to upload asset images while the publish switch is enabled", async () => {
    const imageSafetyInputs: ImageSafetyInput[] = [];
    const contentSafetyService: ContentSafetyService = {
      async assertTextAllowed() {},
      async requestImageCheck(input) {
        imageSafetyInputs.push(input);
        return { status: "pending", traceId: "image-trace-1" };
      },
      async assertImageUploadsAllowed() {},
      async assertAssetImagesAllowed() {}
    };
    const app = buildApp({
      enableMockAuth: true,
      imageStorage: fakeImageStorage(),
      contentSafetyService,
      wechatCodeSessionExchanger: async (code: string) => ({ openid: `openid-${code}` })
    });

    try {
      const token = await wechatLogin(app, "image-uploader-code");

      const response = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          assetType: "账号",
          mimeType: "image/jpeg",
          base64Data: Buffer.from("image").toString("base64")
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().image).toMatchObject({
        mimeType: "image/jpeg",
        sizeBytes: 5,
        publicUrl: expect.stringContaining("uploads/accounts/1/"),
        safetyStatus: "pending",
        safetyTraceId: "image-trace-1"
      });
      expect(imageSafetyInputs).toEqual([
        expect.objectContaining({
          userId: "1",
          objectKey: expect.stringContaining("uploads/accounts/1/"),
          mediaUrl: expect.stringContaining("uploads/accounts/1/"),
          openid: "openid-image-uploader-code"
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("sets the auction end time to 24 hours after admin approval", async () => {
    const assets = createInMemoryAssetsRepository();
    const asset = await createPendingRepositoryAsset(assets, { originalEndAt: "2099-12-31T15:59:59.000Z" });
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const adminToken = await reviewerToken(app);
      const beforeApprove = Date.now();

      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      const afterApprove = Date.now();

      expect(response.statusCode).toBe(200);
      const effectiveEndAt = new Date(response.json().asset.effectiveEndAt).getTime();
      expect(effectiveEndAt).toBeGreaterThanOrEqual(beforeApprove + 24 * 60 * 60 * 1000);
      expect(effectiveEndAt).toBeLessThanOrEqual(afterApprove + 24 * 60 * 60 * 1000);
      expect(response.json().asset.originalEndAt).toBe("2099-12-31T15:59:59.000Z");
    } finally {
      await app.close();
    }
  });

  it("lists only active assets in public list", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({ method: "GET", url: "/api/assets" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        items: [],
        nextCursor: null,
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false
      });
    } finally {
      await app.close();
    }
  });

  it("filters public active assets by game name and asset type", async () => {
    const assets = createInMemoryAssetsRepository();
    const account = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ gameName: "塔防精灵", assetType: "账号", title: "塔防账号" })
    });
    const prop = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ gameName: "塔防精灵", assetType: "道具", title: "塔防道具" })
    });
    const otherGame = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ gameName: "梦幻西游", assetType: "账号", title: "梦幻账号" })
    });
    await assets.updateStatus(account.id, "active");
    await assets.updateStatus(prop.id, "active");
    await assets.updateStatus(otherGame.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([expect.objectContaining({ id: account.id, title: "塔防账号" })]);
    } finally {
      await app.close();
    }
  });

  it("filters public prop assets by principal and Dragon Ball metadata", async () => {
    const assets = createInMemoryAssetsRepository();
    const matching = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({
        gameName: "塔防精灵",
        assetType: "道具",
        principalId: "2",
        itemCategory: "龙珠",
        dragonBall: { element: "冰", profession: "法师", quality: "绿", attributes: "附加伤害+1%" },
        title: "目标法师绿龙珠"
      })
    });
    const otherPrincipal = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({
        gameName: "塔防精灵",
        assetType: "道具",
        principalId: "1",
        itemCategory: "龙珠",
        dragonBall: { element: "冰", profession: "法师", quality: "绿", attributes: "附加伤害+2%" },
        title: "其他主理人绿龙珠"
      })
    });
    const otherProfession = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({
        gameName: "塔防精灵",
        assetType: "道具",
        principalId: "2",
        itemCategory: "龙珠",
        dragonBall: { element: "雷", profession: "猎人", quality: "绿", attributes: "附加伤害+3%" },
        title: "猎人绿龙珠"
      })
    });
    const otherQuality = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({
        gameName: "塔防精灵",
        assetType: "道具",
        principalId: "2",
        itemCategory: "龙珠",
        dragonBall: { element: "冰", profession: "法师", quality: "红", attributes: "附加伤害+4%" },
        title: "法师红龙珠"
      })
    });
    await Promise.all([matching, otherPrincipal, otherProfession, otherQuality].map((asset) => assets.updateStatus(asset.id, "active")));
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const response = await app.inject({
        method: "GET",
        url:
          "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E9%81%93%E5%85%B7&principalId=2&dragonBallProfession=%E6%B3%95%E5%B8%88&dragonBallQuality=%E7%BB%BF"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([
        expect.objectContaining({
          id: matching.id,
          title: "目标法师绿龙珠",
          principal: { id: "2", displayName: "备用主理人" },
          dragonBall: expect.objectContaining({ profession: "法师", quality: "绿" })
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("includes principal summaries in the public asset list", async () => {
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ title: "带主理人的资产", principalId: "1" })
    });
    await assets.updateStatus(asset.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const response = await app.inject({ method: "GET", url: "/api/assets" });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([
        expect.objectContaining({
          id: asset.id,
          principal: { id: "1", displayName: "默认主理人" }
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("does not expose seller game ids in public asset responses", async () => {
    const assets = createInMemoryAssetsRepository();
    const created = await assets.createPending({
      sellerId: "1",
      sellerGameId: "private-game-id-8899",
      ...validAssetPayload({ title: "隐藏卖家游戏ID资产", principalId: "1" })
    });
    const asset = await assets.updateStatus(created.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const list = await app.inject({ method: "GET", url: "/api/assets" });
      expect(list.statusCode).toBe(200);
      expect(list.json().items[0]).toEqual(expect.objectContaining({ id: asset.id }));
      expect(list.json().items[0]).not.toHaveProperty("sellerGameId");

      const detail = await app.inject({ method: "GET", url: `/api/assets/${asset.id}` });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().asset).toEqual(expect.objectContaining({ id: asset.id }));
      expect(detail.json().asset).not.toHaveProperty("sellerGameId");
    } finally {
      await app.close();
    }
  });

  it("defaults public browsing to seven days and keyword searches to sixty days", async () => {
    const assets = createInMemoryAssetsRepository();
    const oldAccount = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ gameName: "塔防精灵", assetType: "账号", title: "旧账号" })
    });
    const recentAccount = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ gameName: "塔防精灵", assetType: "账号", title: "新账号" })
    });
    const oldActive = await assets.updateStatus(oldAccount.id, "active");
    const recentActive = await assets.updateStatus(recentAccount.id, "active");
    await assets.save({
      ...oldActive,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    });
    await assets.save({
      ...recentActive,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    });
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const list = await app.inject({
        method: "GET",
        url: "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7"
      });
      const search = await app.inject({
        method: "GET",
        url:
          "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7&keyword=%E6%97%A7%E8%B4%A6%E5%8F%B7"
      });

      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ id: recentAccount.id, title: "新账号" })]
      });
      expect(search.statusCode).toBe(200);
      expect(search.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ id: oldAccount.id, title: "旧账号" })]
      });
    } finally {
      await app.close();
    }
  });

  it("paginates public active assets", async () => {
    const assets = createInMemoryAssetsRepository();
    const first = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ gameName: "塔防精灵", assetType: "账号", title: "账号一" })
    });
    const second = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ gameName: "塔防精灵", assetType: "账号", title: "账号二" })
    });
    await assets.updateStatus(first.id, "active");
    await assets.updateStatus(second.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7&page=2&pageSize=1"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        total: 2,
        page: 2,
        pageSize: 1,
        hasMore: false
      });
      expect(response.json().items).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("returns updated current price in the public asset list after bidding", async () => {
    const assets = createInMemoryAssetsRepository();
    const asset = await createActiveRepositoryAsset(assets, {
      sellerId: "99",
      gameName: "塔防精灵",
      assetType: "账号",
      title: "最新价资产"
    });
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const bidderToken = await login(app, "买家");
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId: asset.id, amountCents: 12300, commitmentAccepted: true }
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([
        expect.objectContaining({
          id: asset.id,
          startingPriceCents: 10000,
          currentPriceCents: 12300
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("treats legacy equipment assets as props in the public prop list", async () => {
    const assets = createInMemoryAssetsRepository();
    const legacyEquipment = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ gameName: "塔防精灵", assetType: "装备", title: "历史装备" })
    });
    const account = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ gameName: "塔防精灵", assetType: "账号", title: "塔防账号" })
    });
    await assets.updateStatus(legacyEquipment.id, "active");
    await assets.updateStatus(account.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E9%81%93%E5%85%B7"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([expect.objectContaining({ id: legacyEquipment.id, title: "历史装备" })]);
    } finally {
      await app.close();
    }
  });

  it("does not list active assets after their auction end time", async () => {
    const assets = createInMemoryAssetsRepository();
    const expiredAsset = await assets.createPending({
      sellerId: "1",
      ...validAssetPayload({ originalEndAt: new Date(Date.now() - 1000).toISOString() })
    });
    await assets.updateStatus(expiredAsset.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const response = await app.inject({ method: "GET", url: "/api/assets" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        items: [],
        nextCursor: null,
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false
      });
    } finally {
      await app.close();
    }
  });

  it("returns a seller summary and recent bids in asset detail", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await login(app);
      expect(token).toEqual(expect.any(String));
      const asset = await createActiveRepositoryAsset(assets);

      const response = await app.inject({ method: "GET", url: `/api/assets/${asset.id}` });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        seller: {
          id: "1",
          displayName: "卖家",
          banned: false,
          violationCount: 0
        },
        asset: {
          principal: { id: "1", displayName: "默认主理人" }
        },
        recentBids: []
      });
    } finally {
      await app.close();
    }
  });

  it("hides pending assets from unauthenticated detail requests", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await login(app);
      expect(token).toEqual(expect.any(String));
      const asset = await createPendingRepositoryAsset(assets);

      const response = await app.inject({ method: "GET", url: `/api/assets/${asset.id}` });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("asset_not_found");
    } finally {
      await app.close();
    }
  });

  it("allows sellers to view their own pending asset detail", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await login(app);
      const asset = await createPendingRepositoryAsset(assets, { title: "卖家可见待审资产" });

      const response = await app.inject({
        method: "GET",
        url: `/api/assets/${asset.id}`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({ title: "卖家可见待审资产", status: "pending_review" });
    } finally {
      await app.close();
    }
  });

  it("returns bidder summaries in recent bids", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "出价人张宁");
      expect(sellerToken).toEqual(expect.any(String));
      const asset = await createActiveRepositoryAsset(assets);
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId: asset.id, amountCents: 10000, commitmentAccepted: true }
      });

      const response = await app.inject({ method: "GET", url: `/api/assets/${asset.id}` });

      expect(response.statusCode).toBe(200);
      expect(response.json().recentBids).toEqual([
        expect.objectContaining({
          amountCents: 10000,
          bidder: expect.objectContaining({ displayName: "出价人张宁" })
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("keeps confirmed sold asset details visible with ended status", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "成交买家");
      expect(sellerToken).toEqual(expect.any(String));
      const asset = await createActiveRepositoryAsset(assets, { title: "已确认成交资产" });
      const assetId = asset.id;
      const adminToken = await reviewerToken(app);
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });
      const confirmed = await app.inject({
        method: "POST",
        url: `/admin/assets/${assetId}/confirm-deal`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      const response = await app.inject({ method: "GET", url: `/api/assets/${assetId}` });

      expect(confirmed.statusCode).toBe(200);
      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({
        id: assetId,
        title: "已确认成交资产",
        status: "ended",
        currentPriceCents: 10000,
        highestBidderId: "2"
      });
    } finally {
      await app.close();
    }
  });

  it("blocks admin approval while asset images are not content-safety passed", async () => {
    const assets = createInMemoryAssetsRepository();
    const contentSafetyService = {
      async assertTextAllowed() {},
      async assertImageUploadsAllowed() {},
      async assertAssetImagesAllowed() {
        throw new HttpError(400, "image_safety_pending", "Image safety check is not passed");
      }
    };
    const app = buildApp({
      enableMockAuth: true,
      assetsRepository: assets,
      contentSafetyService
    } as Parameters<typeof buildApp>[0]);

    try {
      const asset = await createPendingRepositoryAsset(assets);
      const adminToken = await reviewerToken(app);

      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("image_safety_pending");
    } finally {
      await app.close();
    }
  });

  it("allows admin approval with an explicit manual image safety override while async image checks are pending", async () => {
    const assets = createInMemoryAssetsRepository();
    const contentSafetyService = {
      async assertTextAllowed() {},
      async assertImageUploadsAllowed() {},
      async assertAssetImagesAllowed() {
        throw new HttpError(400, "image_safety_pending", "图片安全检测尚未完成，请稍后刷新后再审核");
      }
    };
    const app = buildApp({
      enableMockAuth: true,
      assetsRepository: assets,
      contentSafetyService
    } as Parameters<typeof buildApp>[0]);

    try {
      const asset = await createPendingRepositoryAsset(assets);
      const adminToken = await reviewerToken(app);

      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { imageSafetyOverride: true }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset.status).toBe("active");
    } finally {
      await app.close();
    }
  });

  it("does not allow manual image safety override for explicitly high-risk images", async () => {
    const assets = createInMemoryAssetsRepository();
    const contentSafetyService = {
      async assertTextAllowed() {},
      async assertImageUploadsAllowed() {},
      async assertAssetImagesAllowed() {
        throw new HttpError(400, "image_safety_risky", "图片命中微信内容安全高风险，请更换图片后再审核通过");
      }
    };
    const app = buildApp({
      enableMockAuth: true,
      assetsRepository: assets,
      contentSafetyService
    } as Parameters<typeof buildApp>[0]);

    try {
      const asset = await createPendingRepositoryAsset(assets);
      const adminToken = await reviewerToken(app);

      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { imageSafetyOverride: true }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("image_safety_risky");
    } finally {
      await app.close();
    }
  });
});

describe("assets repository", () => {
  it("returns cloned assets so callers cannot mutate stored state", async () => {
    const repository = createInMemoryAssetsRepository();
    const created = await repository.createPending({
      sellerId: "1",
      gameName: "梦幻西游",
      serverName: "测试区",
      assetType: "角色",
      title: "69级角色",
      description: "展示用资产",
      startingPriceCents: 10000,
      minIncrementCents: 100,
      originalEndAt: futureEndAt()
    });

    created.title = "mutated";
    created.imageUrls.push("https://example.com/mutated.png");

    const found = await repository.findById(created.id);

    expect(found?.title).toBe("69级角色");
    expect(found?.imageUrls).toEqual([]);
  });

  it("stores a clone when saving assets", async () => {
    const repository = createInMemoryAssetsRepository();
    const created = await repository.createPending({
      sellerId: "1",
      gameName: "梦幻西游",
      serverName: "测试区",
      assetType: "角色",
      title: "69级角色",
      description: "展示用资产",
      startingPriceCents: 10000,
      minIncrementCents: 100,
      originalEndAt: futureEndAt()
    });

    const saved = await repository.save({ ...created, title: "saved", imageUrls: ["https://example.com/a.png"] });
    saved.title = "mutated";
    saved.imageUrls.push("https://example.com/mutated.png");

    const found = await repository.findById(created.id);

    expect(found?.title).toBe("saved");
    expect(found?.imageUrls).toEqual(["https://example.com/a.png"]);
  });
});

describe("image validation", () => {
  it("rejects invalid image sizes", () => {
    expect(() => validateImageUpload({ mimeType: "image/png", sizeBytes: 0 })).toThrow(
      new Error("Invalid image size")
    );
    expect(() => validateImageUpload({ mimeType: "image/png", sizeBytes: 1.5 })).toThrow(
      new Error("Invalid image size")
    );
    expect(() => validateImageUpload({ mimeType: "image/png", sizeBytes: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
      new Error("Invalid image size")
    );
  });

  it("rejects unsupported and empty image types", () => {
    expect(() => validateImageUpload({ mimeType: "", sizeBytes: 100 })).toThrow(
      new Error("Unsupported image type")
    );
    expect(() => validateImageUpload({ mimeType: 123, sizeBytes: 100 })).toThrow(
      new Error("Unsupported image type")
    );
    expect(() => validateImageUpload({ mimeType: "application/pdf", sizeBytes: 100 })).toThrow(
      new Error("Unsupported image type")
    );
  });
});
