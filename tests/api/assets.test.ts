import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import { HttpError } from "../../api/src/http/errors";
import { createInMemoryAssetsRepository } from "../../api/src/modules/assets/assets.repository";
import type { ImageStorage } from "../../api/src/modules/images/r2Storage";
import { validateImageUpload } from "../../api/src/modules/images/images.service";
import { createInMemoryUsersRepository } from "../../api/src/modules/users/users.repository";

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

async function reviewerToken(app: ReturnType<typeof buildApp>) {
  const response = await app.inject({
    method: "POST",
    url: "/admin/auth/login",
    payload: { username: "reviewer", password: "reviewer-pass" }
  });
  return response.json().token as string;
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

  it("creates an asset in pending_review", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset.status).toBe("pending_review");
    } finally {
      await app.close();
    }
  });

  it("uses a default future end time when publishing omits originalEndAt", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);
      const { originalEndAt: _originalEndAt, ...payload } = validAssetPayload();

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({
        status: "pending_review",
        originalEndAt: "2099-12-31T15:59:59.000Z",
        effectiveEndAt: "2099-12-31T15:59:59.000Z"
      });
    } finally {
      await app.close();
    }
  });

  it("sets the auction end time to 24 hours after admin approval", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ originalEndAt: "2099-12-31T15:59:59.000Z" })
      });
      const adminToken = await reviewerToken(app);
      const beforeApprove = Date.now();

      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${createResponse.json().asset.id}/approve`,
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

  it("creates dragon ball item metadata for prop assets", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({
          assetType: "道具",
          itemCategory: "龙珠",
          title: "金色暗系龙珠",
          dragonBall: {
            profession: "战士",
            quality: "金",
            attributes: "附加伤害+10%，无视冰甲+5%"
          }
        })
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({
        assetType: "道具",
        itemCategory: "龙珠",
        dragonBall: {
          element: "暗",
          profession: "战士",
          quality: "金",
          attributes: "附加伤害+10%，无视冰甲+5%"
        }
      });
    } finally {
      await app.close();
    }
  });

  it("rejects invalid dragon ball metadata", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({
          assetType: "道具",
          itemCategory: "龙珠",
          title: "异常龙珠",
          dragonBall: {
            profession: "刺客",
            quality: "金",
            attributes: "附加伤害+10%，无视冰甲+5%"
          }
        })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_dragon_ball");
    } finally {
      await app.close();
    }
  });

  it("blocks asset publishing when text content safety rejects the payload", async () => {
    const contentSafetyService = {
      async assertTextAllowed() {
        throw new HttpError(400, "content_safety_risky", "Content safety check failed");
      },
      async assertImageUploadsAllowed() {}
    };
    const app = buildApp({ enableMockAuth: true, contentSafetyService } as Parameters<typeof buildApp>[0]);

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ title: "违规广告资产" })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("content_safety_risky");
    } finally {
      await app.close();
    }
  });

  it("rejects asset publishing from banned users even with an existing token", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users });

    try {
      const token = await login(app);
      await users.banUser(1, "线下交易违约");

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toMatchObject({
        code: "user_banned",
        message: "User is banned",
        details: { reason: "线下交易违约" }
      });
    } finally {
      await app.close();
    }
  });

  it("blocks asset publishing when the seller credit score is 70 or below", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users });

    try {
      const token = await login(app);
      await users.deductCreditScore(1, 30);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toMatchObject({
        code: "credit_score_too_low",
        message: "Credit score is too low for this action",
        details: { creditScore: 70, minimumExclusive: 70 }
      });
    } finally {
      await app.close();
    }
  });

  it("limits regular users to three asset publications per China day by default", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);
      for (let index = 0; index < 3; index++) {
        const response = await app.inject({
          method: "POST",
          url: "/api/assets",
          headers: { authorization: `Bearer ${token}` },
          payload: validAssetPayload({ title: `第 ${index + 1} 条资产` })
        });
        expect(response.statusCode).toBe(200);
      }

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ title: "第 4 条资产" })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatchObject({
        code: "publish_limit_reached",
        message: "Daily publish limit reached",
        details: { limit: 3, used: 3 }
      });
    } finally {
      await app.close();
    }
  });

  it("blocks publishing when an admin sets the user's daily publish limit to zero", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);
      const adminLoginResponse = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "super", password: "super-pass" }
      });
      const adminToken = adminLoginResponse.json().token as string;
      const limitResponse = await app.inject({
        method: "POST",
        url: "/admin/users/1/publish-limit",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { limit: 0 }
      });
      expect(limitResponse.statusCode).toBe(200);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatchObject({
        code: "publish_limit_reached",
        message: "Daily publish limit reached",
        details: { limit: 0, used: 0 }
      });
    } finally {
      await app.close();
    }
  });

  it("uploads images and attaches them to newly created assets", async () => {
    const app = buildApp({ enableMockAuth: true, imageStorage: fakeImageStorage() });

    try {
      const token = await login(app);
      const upload = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          fileName: "role.png",
          mimeType: "image/png",
          base64Data: Buffer.from("png-bytes").toString("base64")
        }
      });
      expect(upload.statusCode).toBe(200);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ images: [upload.json().image] })
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset.imageUrls).toEqual([upload.json().image.publicUrl]);

      const detail = await app.inject({
        method: "GET",
        url: `/api/assets/${response.json().asset.id}`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().asset.imageUrls).toEqual([upload.json().image.publicUrl]);
    } finally {
      await app.close();
    }
  });

  it("checks asset images before creating an asset", async () => {
    const image = {
      objectKey: "uploads/accounts/1/untrusted.jpg",
      publicUrl: "https://img.example.com/uploads/accounts/1/untrusted.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024
    };
    let checkedImages: unknown = null;
    const contentSafetyService = {
      async assertTextAllowed() {},
      async requestImageCheck() {
        return { status: "pass" as const };
      },
      async assertAssetImagesAllowed() {},
      async assertImageUploadsAllowed(input: unknown) {
        checkedImages = input;
        throw new HttpError(400, "invalid_asset_images", "Asset images must be uploaded by current user");
      }
    };
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService
    } as Parameters<typeof buildApp>[0]);

    try {
      const token = await login(app);
      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ images: [image] })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatchObject({
        code: "invalid_asset_images",
        message: "Asset images must be uploaded by current user"
      });
      expect(checkedImages).toEqual({ userId: "1", images: [image] });
    } finally {
      await app.close();
    }
  });

  it("separates uploaded image object keys by asset type", async () => {
    const app = buildApp({ enableMockAuth: true, imageStorage: fakeImageStorage() });

    try {
      const token = await login(app);
      const accountUpload = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          assetType: "账号",
          fileName: "account.jpg",
          mimeType: "image/jpeg",
          base64Data: Buffer.from("account-image").toString("base64")
        }
      });
      const itemUpload = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          assetType: "道具",
          fileName: "item.png",
          mimeType: "image/png",
          base64Data: Buffer.from("item-image").toString("base64")
        }
      });

      expect(accountUpload.statusCode).toBe(200);
      expect(itemUpload.statusCode).toBe(200);
      expect(accountUpload.json().image.objectKey).toMatch(/^uploads\/accounts\/1\/[0-9a-f-]+\.jpg$/);
      expect(itemUpload.json().image.objectKey).toMatch(/^uploads\/items\/1\/[0-9a-f-]+\.png$/);
      expect(accountUpload.json().image.publicUrl).toContain("/uploads/accounts/1/");
      expect(itemUpload.json().image.publicUrl).toContain("/uploads/items/1/");
    } finally {
      await app.close();
    }
  });

  it("rejects unsupported image asset type routing hints", async () => {
    const app = buildApp({ enableMockAuth: true, imageStorage: fakeImageStorage() });

    try {
      const token = await login(app);
      const response = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          assetType: "材料",
          fileName: "material.png",
          mimeType: "image/png",
          base64Data: Buffer.from("item-image").toString("base64")
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_image_asset_type");
    } finally {
      await app.close();
    }
  });

  it("requests async image content safety after uploading to storage", async () => {
    const checks: Array<{ mediaUrl: string; objectKey: string }> = [];
    const contentSafetyService = {
      async requestImageCheck(input: { mediaUrl: string; objectKey: string }) {
        checks.push(input);
        return { status: "pending", traceId: "trace-1" };
      }
    };
    const app = buildApp({
      enableMockAuth: true,
      imageStorage: fakeImageStorage(),
      contentSafetyService
    } as Parameters<typeof buildApp>[0]);

    try {
      const token = await login(app);
      const response = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          fileName: "role.png",
          mimeType: "image/png",
          base64Data: Buffer.from("png-bytes").toString("base64")
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().image.safetyStatus).toBe("pending");
      expect(response.json().image.safetyTraceId).toBe("trace-1");
      expect(checks).toEqual([
        expect.objectContaining({
          objectKey: response.json().image.objectKey,
          mediaUrl: response.json().image.publicUrl,
          scene: 3
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("accepts a single image upload above the default Fastify body limit", async () => {
    const app = buildApp({ enableMockAuth: true, imageStorage: fakeImageStorage() });

    try {
      const token = await login(app);
      const response = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          fileName: "large-role.png",
          mimeType: "image/png",
          base64Data: Buffer.alloc(900 * 1024, 1).toString("base64")
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().image).toMatchObject({
        mimeType: "image/png",
        sizeBytes: 900 * 1024
      });
    } finally {
      await app.close();
    }
  });

  it("rejects image uploads from banned users even with an existing token", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users, imageStorage: fakeImageStorage() });

    try {
      const token = await login(app);
      await users.banUser(1, "线下交易违约");

      const response = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          fileName: "role.png",
          mimeType: "image/png",
          base64Data: Buffer.from("png-bytes").toString("base64")
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("user_banned");
    } finally {
      await app.close();
    }
  });

  it("rejects image uploads when the user credit score is 70 or below", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users, imageStorage: fakeImageStorage() });

    try {
      const token = await login(app);
      await users.deductCreditScore(1, 30);

      const response = await app.inject({
        method: "POST",
        url: "/api/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          fileName: "role.png",
          mimeType: "image/png",
          base64Data: Buffer.from("png-bytes").toString("base64")
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toMatchObject({
        code: "credit_score_too_low",
        message: "Credit score is too low for this action",
        details: { creditScore: 70, minimumExclusive: 70 }
      });
    } finally {
      await app.close();
    }
  });

  it("rejects image uploads without login", async () => {
    const app = buildApp({ enableMockAuth: true, imageStorage: fakeImageStorage() });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/images",
        payload: { fileName: "role.png", mimeType: "image/png", base64Data: "abc" }
      });

      expect(response.statusCode).toBe(401);
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
    const app = buildApp({ enableMockAuth: true });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "买家");
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: validAssetPayload({ gameName: "塔防精灵", assetType: "账号", title: "最新价资产" })
      });
      const assetId = createResponse.json().asset.id;
      const adminToken = await reviewerToken(app);
      await app.inject({
        method: "POST",
        url: `/admin/assets/${assetId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 12300, commitmentAccepted: true }
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([
        expect.objectContaining({
          id: assetId,
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

  it("rejects whitespace-only descriptions", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ description: "   " })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_asset");
    } finally {
      await app.close();
    }
  });

  it("rejects invalid original end times", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ originalEndAt: "not-a-date" })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_end_time");
    } finally {
      await app.close();
    }
  });

  it("rejects normalized-invalid original end times", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ originalEndAt: "2026-06-31T00:00:00.000Z" })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_end_time");
    } finally {
      await app.close();
    }
  });

  it("rejects past original end times", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ originalEndAt: "2020-01-01T00:00:00.000Z" })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_end_time");
    } finally {
      await app.close();
    }
  });

  it("rejects unsafe starting prices", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ startingPriceCents: Number.MAX_SAFE_INTEGER + 1 })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_price");
    } finally {
      await app.close();
    }
  });

  it("rejects starting prices with fractional yuan amounts", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ startingPriceCents: 1050 })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_price");
    } finally {
      await app.close();
    }
  });

  it("rejects unsafe minimum increments", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ minIncrementCents: Number.MAX_SAFE_INTEGER + 1 })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_increment");
    } finally {
      await app.close();
    }
  });

  it("rejects minimum increments with fractional yuan amounts", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ minIncrementCents: 150 })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_increment");
    } finally {
      await app.close();
    }
  });

  it("trims text fields in created assets", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({
          gameName: " 梦幻西游 ",
          serverName: " 测试区 ",
          assetType: " 角色 ",
          title: " 69级角色 ",
          description: " 展示用资产 "
        })
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({
        gameName: "梦幻西游",
        serverName: "测试区",
        assetType: "角色",
        title: "69级角色",
        description: "展示用资产"
      });
    } finally {
      await app.close();
    }
  });

  it("returns a seller summary and recent bids in asset detail", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });
      const assetId = createResponse.json().asset.id;
      const adminToken = await reviewerToken(app);
      await app.inject({
        method: "POST",
        url: `/admin/assets/${assetId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      const response = await app.inject({ method: "GET", url: `/api/assets/${assetId}` });

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
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });

      const response = await app.inject({ method: "GET", url: `/api/assets/${createResponse.json().asset.id}` });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("asset_not_found");
    } finally {
      await app.close();
    }
  });

  it("allows sellers to view their own pending asset detail", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await login(app);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload({ title: "卖家可见待审资产" })
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/assets/${createResponse.json().asset.id}`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({ title: "卖家可见待审资产", status: "pending_review" });
    } finally {
      await app.close();
    }
  });

  it("returns bidder summaries in recent bids", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "出价人张宁");
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: validAssetPayload()
      });
      const assetId = createResponse.json().asset.id;
      const adminToken = await reviewerToken(app);
      await app.inject({
        method: "POST",
        url: `/admin/assets/${assetId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });

      const response = await app.inject({ method: "GET", url: `/api/assets/${assetId}` });

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
    const app = buildApp({ enableMockAuth: true });

    try {
      const sellerToken = await login(app, "卖家");
      const bidderToken = await login(app, "成交买家");
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: validAssetPayload({ title: "已确认成交资产" })
      });
      const assetId = createResponse.json().asset.id;
      const adminToken = await reviewerToken(app);
      await app.inject({
        method: "POST",
        url: `/admin/assets/${assetId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
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
      const token = await login(app);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });
      const adminToken = await reviewerToken(app);

      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${createResponse.json().asset.id}/approve`,
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
      const token = await login(app);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });
      const adminToken = await reviewerToken(app);

      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${createResponse.json().asset.id}/approve`,
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
      const token = await login(app);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: validAssetPayload()
      });
      const adminToken = await reviewerToken(app);

      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${createResponse.json().asset.id}/approve`,
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
