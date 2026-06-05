import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import {
  createInMemoryAdminRepository,
  type AdminOperationLog,
  type AdminRepository,
  type AdminUserRow
} from "../../api/src/modules/admin/admin.repository";
import { canAdmin } from "../../api/src/modules/admin/adminPermissions";
import { createInMemoryAssetsRepository } from "../../api/src/modules/assets/assets.repository";
import { createInMemoryImageSafetyRepository } from "../../api/src/modules/contentSafety/imageSafety.repository";
import {
  createInMemoryDealFollowupsRepository,
  type DealFollowupsRepository
} from "../../api/src/modules/dealFollowups/dealFollowups.repository";
import { createReportsService } from "../../api/src/modules/reports/reports.service";

describe("admin permissions", () => {
  it("allows reviewer to review assets but not manage admins", () => {
    expect(canAdmin("reviewer", "asset:review")).toBe(true);
    expect(canAdmin("reviewer", "asset:create")).toBe(true);
    expect(canAdmin("reviewer", "auction:confirm_deal")).toBe(true);
    expect(canAdmin("reviewer", "admin:manage")).toBe(false);
    expect(canAdmin("reviewer", "user:view")).toBe(false);
  });

  it("allows super admin to manage admins", () => {
    expect(canAdmin("super_admin", "admin:manage")).toBe(true);
  });
});

describe("admin routes", () => {
  async function adminLogin(app: ReturnType<typeof buildApp>, username: string, password: string) {
    const response = await app.inject({
      method: "POST",
      url: "/admin/auth/login",
      payload: { username, password }
    });
    return response.json().token as string;
  }

  async function userLogin(app: ReturnType<typeof buildApp>) {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/mock-login",
      payload: { displayName: "User Token" }
    });
    return response.json().token as string;
  }

  function pendingAssetInput() {
    return {
      sellerId: "1",
      principalId: "1",
      gameName: "梦幻西游",
      serverName: "测试区",
      assetType: "角色",
      title: "69级角色",
      description: "展示用资产",
      startingPriceCents: 10000,
      minIncrementCents: 100,
      originalEndAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  function adminAssetPayload(overrides: Record<string, unknown> = {}) {
    return {
      principalId: "1",
      gameName: "塔防精灵",
      serverName: "内容审核区",
      assetType: "账号",
      sellerGameId: "game-seller-1001",
      title: "后台代发账号",
      description: "后台主理人代发的交换信息",
      startingPriceCents: 10000,
      minIncrementCents: 100,
      endAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      images: [],
      ...overrides
    };
  }

  it("logs in a seeded reviewer", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "reviewer", password: "reviewer-pass" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().admin.role).toBe("reviewer");
    } finally {
      await app.close();
    }
  });

  it("rejects non-string admin login payloads", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: 123, password: "reviewer-pass" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_admin_credentials");
    } finally {
      await app.close();
    }
  });

  it("allows the current backend user to change their own password", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");

      const wrongCurrentPassword = await app.inject({
        method: "POST",
        url: "/admin/auth/change-password",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          currentPassword: "wrong-password",
          newPassword: "new-reviewer-pass",
          confirmNewPassword: "new-reviewer-pass"
        }
      });
      expect(wrongCurrentPassword.statusCode).toBe(401);
      expect(wrongCurrentPassword.json().error.code).toBe("invalid_current_password");

      const mismatch = await app.inject({
        method: "POST",
        url: "/admin/auth/change-password",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          currentPassword: "reviewer-pass",
          newPassword: "new-reviewer-pass",
          confirmNewPassword: "new-reviewer-pass-mismatch"
        }
      });
      expect(mismatch.statusCode).toBe(400);
      expect(mismatch.json().error.code).toBe("invalid_admin_password_confirmation");

      const changed = await app.inject({
        method: "POST",
        url: "/admin/auth/change-password",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          currentPassword: "reviewer-pass",
          newPassword: "new-reviewer-pass",
          confirmNewPassword: "new-reviewer-pass"
        }
      });
      expect(changed.statusCode).toBe(200);
      expect(changed.json().admin).toMatchObject({ username: "reviewer", role: "reviewer" });

      const oldLogin = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "reviewer", password: "reviewer-pass" }
      });
      expect(oldLogin.statusCode).toBe(401);

      const newLogin = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "reviewer", password: "new-reviewer-pass" }
      });
      expect(newLogin.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("allows a super admin to publish an active asset with a selected principal and end time", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "super", "super-pass");
      const endAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

      const response = await app.inject({
        method: "POST",
        url: "/admin/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: adminAssetPayload({ principalId: "2", endAt })
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({
        status: "active",
        principalId: "2",
        sellerId: "1",
        sellerGameId: "game-seller-1001",
        originalEndAt: endAt,
        effectiveEndAt: endAt
      });
    } finally {
      await app.close();
    }
  });

  it("returns an editable copy draft for an existing asset without creating a new asset", async () => {
    const assets = createInMemoryAssetsRepository();
    const source = await assets.createPending({
      ...pendingAssetInput(),
      principalId: "1",
      sellerGameId: "seller-game-copy",
      assetType: "道具",
      itemCategory: "龙珠",
      dragonBall: {
        element: "水",
        profession: "法师",
        quality: "红",
        attributes: "附加伤害+12%，无视冰甲+8%"
      },
      title: "可复制历史资产",
      description: "用于快速复刻发布",
      startingPriceCents: 8800,
      minIncrementCents: 200,
      images: [
        {
          objectKey: "uploads/items/1/copy.png",
          publicUrl: "https://img.example.com/uploads/items/1/copy.png",
          mimeType: "image/png",
          sizeBytes: 2048
        }
      ]
    });
    await assets.updateStatus(source.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "GET",
        url: `/admin/assets/${source.id}/copy-draft`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().draft).toEqual({
        sourceAssetId: source.id,
        principalId: "1",
        gameName: "梦幻西游",
        sellerGameId: "seller-game-copy",
        serverName: "测试区",
        assetType: "道具",
        itemCategory: "龙珠",
        dragonBall: {
          element: "水",
          profession: "法师",
          quality: "红",
          attributes: "附加伤害+12%，无视冰甲+8%"
        },
        title: "可复制历史资产",
        description: "用于快速复刻发布",
        startingPriceCents: 8800,
        minIncrementCents: 200,
        images: [
          {
            objectKey: "uploads/items/1/copy.png",
            publicUrl: "https://img.example.com/uploads/items/1/copy.png",
            mimeType: "image/png",
            sizeBytes: 2048
          }
        ]
      });
      await expect(assets.listForAdmin({ status: "pending_review", page: 1, pageSize: 20 })).resolves.toMatchObject({ total: 0 });
    } finally {
      await app.close();
    }
  });

  it("requires and returns the seller game id for admin published assets", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "super", "super-pass");

      const missing = await app.inject({
        method: "POST",
        url: "/admin/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: adminAssetPayload({ sellerGameId: "" })
      });
      expect(missing.statusCode).toBe(400);
      expect(missing.json().error.code).toBe("invalid_seller_game_id");

      const created = await app.inject({
        method: "POST",
        url: "/admin/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: adminAssetPayload({ sellerGameId: "game-7788" })
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().asset.sellerGameId).toBe("game-7788");

      const listed = await app.inject({
        method: "GET",
        url: "/admin/assets",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json().items).toEqual([expect.objectContaining({ id: created.json().asset.id, sellerGameId: "game-7788" })]);

      const detail = await app.inject({
        method: "GET",
        url: `/admin/assets/${created.json().asset.id}`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().asset.sellerGameId).toBe("game-7788");
    } finally {
      await app.close();
    }
  });

  it("defaults admin published asset end time to six hours from now", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const beforePublish = Date.now();

      const response = await app.inject({
        method: "POST",
        url: "/admin/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: adminAssetPayload({ endAt: undefined })
      });
      const afterPublish = Date.now();

      expect(response.statusCode).toBe(200);
      expect(response.json().asset.status).toBe("active");
      const originalEndAt = new Date(response.json().asset.originalEndAt).getTime();
      const effectiveEndAt = new Date(response.json().asset.effectiveEndAt).getTime();
      expect(originalEndAt).toBeGreaterThanOrEqual(beforePublish + 6 * 60 * 60 * 1000);
      expect(originalEndAt).toBeLessThanOrEqual(afterPublish + 6 * 60 * 60 * 1000);
      expect(effectiveEndAt).toBe(originalEndAt);
    } finally {
      await app.close();
    }
  });

  it("rejects admin published assets with a past end time", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");

      const response = await app.inject({
        method: "POST",
        url: "/admin/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: adminAssetPayload({ endAt: "2020-01-01T00:00:00.000Z" })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_asset_end_at");
    } finally {
      await app.close();
    }
  });

  it("prevents a principal admin from publishing into another principal scope", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");

      const response = await app.inject({
        method: "POST",
        url: "/admin/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: adminAssetPayload({ principalId: "1" })
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset.principalId).toBe("1");
    } finally {
      await app.close();
    }
  });

  it("blocks locally risky text when admins publish assets", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");

      const response = await app.inject({
        method: "POST",
        url: "/admin/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: adminAssetPayload({ title: "赌博账号" })
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("content_safety_risky");
    } finally {
      await app.close();
    }
  });

  it("uploads admin asset images without requiring a miniapp user token", async () => {
    const app = buildApp({
      enableMockAuth: true,
      imageStorage: {
        async putImage(input) {
          return {
            objectKey: input.objectKey,
            publicUrl: `https://img.example.com/${input.objectKey}`
          };
        },
        async getImage() {
          return null;
        }
      }
    });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");

      const response = await app.inject({
        method: "POST",
        url: "/admin/images",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          assetType: "道具",
          mimeType: "image/png",
          base64Data: Buffer.from("png bytes").toString("base64")
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().image).toMatchObject({
        mimeType: "image/png",
        sizeBytes: 9,
        safetyStatus: "pass"
      });
      expect(response.json().image.objectKey).toContain("uploads/items/1/");
    } finally {
      await app.close();
    }
  });

  it("rate limits repeated invalid admin login attempts", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      for (let index = 0; index < 5; index += 1) {
        const response = await app.inject({
          method: "POST",
          url: "/admin/auth/login",
          payload: { username: "reviewer", password: "wrong-password" }
        });
        expect(response.statusCode).toBe(401);
      }

      const blocked = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "reviewer", password: "reviewer-pass" }
      });

      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().error).toMatchObject({
        code: "admin_login_rate_limited",
        message: "Too many admin login attempts, please try again later"
      });
    } finally {
      await app.close();
    }
  });

  it("returns real dashboard metrics and pending work items", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const sellerLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "仪表盘卖家" }
      });
      const bidderLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "仪表盘买家" }
      });
      const bidderToken = bidderLogin.json().token as string;
      const sellerId = sellerLogin.json().user.id as string;
      const bidderId = bidderLogin.json().user.id as string;
      const pendingAsset = await assets.createPending({ ...pendingAssetInput(), sellerId, title: "待办资产" });
      const activeAsset = await assets.createPending({ ...pendingAssetInput(), sellerId, title: "进行中资产" });
      await assets.updateStatus(activeAsset.id, "active");
      const adminToken = await adminLogin(app, "super", "super-pass");
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId: activeAsset.id, amountCents: 10000, commitmentAccepted: true }
      });
      await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { targetUserId: sellerId, assetId: activeAsset.id, reason: "资料不完整", evidence: "截图说明" }
      });
      await app.inject({
        method: "POST",
        url: `/admin/users/${bidderId}/ban`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: "测试封禁" }
      });

      const response = await app.inject({
        method: "GET",
        url: "/admin/dashboard",
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        metrics: {
          pendingAssets: 1,
          activeAssets: 1,
          pendingReports: 1,
          bannedUsers: 1,
          totalUsers: 2,
          todayNewUsers: 2,
          todayPublishedAssets: 2,
          todayBids: 1
        },
        pendingAssets: [expect.objectContaining({ id: pendingAsset.id, title: "待办资产" })],
        pendingReports: [
          expect.objectContaining({ reason: "资料不完整", targetUserId: sellerId, assetId: activeAsset.id })
        ]
      });
    } finally {
      await app.close();
    }
  });

  it("allows admins to open asset detail from management lists", async () => {
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending({ ...pendingAssetInput(), title: "详情资产" });
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "super", "super-pass");
      const response = await app.inject({
        method: "GET",
        url: `/admin/assets/${asset.id}`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({ id: asset.id, title: "详情资产", status: "pending_review" });
    } finally {
      await app.close();
    }
  });

  it("returns image safety records in admin review list and asset detail", async () => {
    const assets = createInMemoryAssetsRepository();
    const imageSafety = createInMemoryImageSafetyRepository();
    const publicUrl = "https://img.example.com/uploads/accounts/1/safe.jpg";
    const objectKey = "uploads/accounts/1/safe.jpg";
    const asset = await assets.createPending({
      ...pendingAssetInput(),
      title: "带图审核资产",
      images: [{ objectKey, publicUrl, mimeType: "image/jpeg", sizeBytes: 1234 }]
    });
    await imageSafety.record({
      userId: "1",
      objectKey,
      publicUrl,
      status: "pass",
      traceId: "trace-safe-1",
      label: 100
    });
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets, imageSafetyRepository: imageSafety });

    try {
      const token = await adminLogin(app, "super", "super-pass");
      const reviewList = await app.inject({
        method: "GET",
        url: "/admin/assets/review",
        headers: { authorization: `Bearer ${token}` }
      });
      const detail = await app.inject({
        method: "GET",
        url: `/admin/assets/${asset.id}`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(reviewList.statusCode).toBe(200);
      expect(reviewList.json().items).toEqual([
        expect.objectContaining({
          id: asset.id,
          imageSafetyChecks: [
            expect.objectContaining({
              publicUrl,
              objectKey,
              status: "pass",
              traceId: "trace-safe-1",
              label: 100
            })
          ]
        })
      ]);
      expect(detail.statusCode).toBe(200);
      expect(detail.json()).toMatchObject({
        imageSafetyChecks: [
          {
            publicUrl,
            objectKey,
            status: "pass",
            traceId: "trace-safe-1",
            label: 100
          }
        ]
      });
    } finally {
      await app.close();
    }
  });

  it("returns recent bid records in admin asset detail", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const sellerLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "后台详情卖家" }
      });
      const bidderLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "后台详情买家" }
      });
      const bidderToken = bidderLogin.json().token as string;
      const asset = await assets.createPending({
        ...pendingAssetInput(),
        sellerId: sellerLogin.json().user.id,
        title: "有竞价详情资产"
      });
      await assets.updateStatus(asset.id, "active");
      const assetId = asset.id;
      const adminToken = await adminLogin(app, "super", "super-pass");
      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidderToken}` },
        payload: { assetId, amountCents: 10000, commitmentAccepted: true }
      });

      const response = await app.inject({
        method: "GET",
        url: `/admin/assets/${assetId}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        asset: { id: assetId, currentPriceCents: 10000, highestBidderId: bidderLogin.json().user.id },
        seller: expect.objectContaining({ id: sellerLogin.json().user.id, displayName: "后台详情卖家" }),
        principal: { id: "1", displayName: "默认主理人" },
        recentBids: [
          expect.objectContaining({
            assetId,
            amountCents: 10000,
            bidder: expect.objectContaining({ displayName: "后台详情买家" })
          })
        ]
      });
    } finally {
      await app.close();
    }
  });

  it("keeps public principal lookup available while miniapp publishing is disabled", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "发布用户" }
      });
      const token = login.json().token as string;

      const principals = await app.inject({ method: "GET", url: "/api/principals" });
      expect(principals.statusCode).toBe(200);
      expect(principals.json().items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "1", displayName: "默认主理人" })])
      );

      const created = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...pendingAssetInput(), principalId: "1" }
      });
      expect(created.statusCode).toBe(410);
      expect(created.json().error.code).toBe("user_asset_publish_disabled");
    } finally {
      await app.close();
    }
  });

  it("allows only super admins to manage principal records", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const reviewerToken = await adminLogin(app, "reviewer", "reviewer-pass");
      const denied = await app.inject({
        method: "GET",
        url: "/admin/principals",
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      expect(denied.statusCode).toBe(403);

      const superToken = await adminLogin(app, "super", "super-pass");
      const saved = await app.inject({
        method: "POST",
        url: "/admin/principals",
        headers: { authorization: `Bearer ${superToken}` },
        payload: { adminId: "1", displayName: "塔防主理人" }
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json().principal).toMatchObject({ adminId: "1", username: "reviewer", displayName: "塔防主理人" });

      const active = await app.inject({ method: "GET", url: "/api/principals" });
      expect(active.json().items).toEqual(expect.arrayContaining([expect.objectContaining({ id: "1", displayName: "塔防主理人" })]));

      const disabled = await app.inject({
        method: "POST",
        url: "/admin/principals",
        headers: { authorization: `Bearer ${superToken}` },
        payload: { adminId: "1", displayName: "塔防主理人", disabled: true }
      });
      expect(disabled.statusCode).toBe(200);

      const afterDisable = await app.inject({ method: "GET", url: "/api/principals" });
      expect(afterDisable.json().items).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "1", displayName: "塔防主理人" })])
      );
    } finally {
      await app.close();
    }
  });

  it("lists backend admin accounts for principal binding", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const reviewerToken = await adminLogin(app, "reviewer", "reviewer-pass");
      const denied = await app.inject({
        method: "GET",
        url: "/admin/admin-users",
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      expect(denied.statusCode).toBe(403);

      const superToken = await adminLogin(app, "super", "super-pass");
      const response = await app.inject({
        method: "GET",
        url: "/admin/admin-users",
        headers: { authorization: `Bearer ${superToken}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          expect.objectContaining({ id: "1", username: "reviewer", role: "reviewer", disabledAt: null }),
          expect.objectContaining({ id: "2", username: "operator", role: "operator", disabledAt: null }),
          expect.objectContaining({ id: "3", username: "super", role: "super_admin", disabledAt: null })
        ],
        total: 3,
        page: 1,
        pageSize: 20
      });
    } finally {
      await app.close();
    }
  });

  it("paginates backend admin users and principals", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "super", "super-pass");

      const admins = await app.inject({
        method: "GET",
        url: "/admin/admin-users?page=2&pageSize=2",
        headers: { authorization: `Bearer ${token}` }
      });
      const principals = await app.inject({
        method: "GET",
        url: "/admin/principals?page=2&pageSize=1",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(admins.statusCode).toBe(200);
      expect(admins.json()).toMatchObject({ total: 3, page: 2, pageSize: 2 });
      expect(admins.json().items.map((admin: { username: string }) => admin.username)).toEqual(["super"]);
      expect(principals.statusCode).toBe(200);
      expect(principals.json()).toMatchObject({ total: 2, page: 2, pageSize: 1 });
      expect(principals.json().items.map((principal: { id: string }) => principal.id)).toEqual(["2"]);
    } finally {
      await app.close();
    }
  });

  it("allows super admins to create update and disable backend admin accounts", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const superToken = await adminLogin(app, "super", "super-pass");
      const created = await app.inject({
        method: "POST",
        url: "/admin/admin-users",
        headers: { authorization: `Bearer ${superToken}` },
        payload: { username: "principal-a", password: "principal-pass-1", role: "reviewer" }
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().admin).toMatchObject({ username: "principal-a", role: "reviewer", disabledAt: null });

      const firstLogin = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "principal-a", password: "principal-pass-1" }
      });
      expect(firstLogin.statusCode).toBe(200);
      expect(firstLogin.json().admin.role).toBe("reviewer");

      const adminId = created.json().admin.id as string;
      const principal = await app.inject({
        method: "POST",
        url: "/admin/principals",
        headers: { authorization: `Bearer ${superToken}` },
        payload: { adminId, displayName: "主理人甲" }
      });
      expect(principal.statusCode).toBe(200);

      const updated = await app.inject({
        method: "POST",
        url: `/admin/admin-users/${adminId}/update`,
        headers: { authorization: `Bearer ${superToken}` },
        payload: { username: "principal-b", role: "operator" }
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().admin).toMatchObject({ id: adminId, username: "principal-b", role: "operator" });

      const loginAfterBasicUpdate = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "principal-b", password: "principal-pass-1" }
      });
      expect(loginAfterBasicUpdate.statusCode).toBe(200);
      expect(loginAfterBasicUpdate.json().admin.role).toBe("operator");

      const resetPassword = await app.inject({
        method: "POST",
        url: `/admin/admin-users/${adminId}/reset-password`,
        headers: { authorization: `Bearer ${superToken}` }
      });
      expect(resetPassword.statusCode).toBe(200);
      expect(resetPassword.json().admin).toMatchObject({ id: adminId, username: "principal-b", role: "operator" });
      expect(resetPassword.json().temporaryPassword).toEqual(expect.any(String));
      expect(resetPassword.json().temporaryPassword).not.toBe("888888");
      expect(resetPassword.json().temporaryPassword.length).toBeGreaterThanOrEqual(12);

      const oldPasswordLogin = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "principal-b", password: "principal-pass-1" }
      });
      expect(oldPasswordLogin.statusCode).toBe(401);

      const defaultPasswordLogin = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "principal-b", password: "888888" }
      });
      expect(defaultPasswordLogin.statusCode).toBe(401);

      const temporaryPasswordLogin = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "principal-b", password: resetPassword.json().temporaryPassword }
      });
      expect(temporaryPasswordLogin.statusCode).toBe(200);

      const disabled = await app.inject({
        method: "DELETE",
        url: `/admin/admin-users/${adminId}`,
        headers: { authorization: `Bearer ${superToken}` }
      });
      expect(disabled.statusCode).toBe(200);
      expect(disabled.json().admin).toMatchObject({ id: adminId, disabledAt: expect.any(String) });

      const activePrincipals = await app.inject({ method: "GET", url: "/api/principals" });
      expect(activePrincipals.json().items).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: principal.json().principal.id, displayName: "主理人甲" })])
      );

      const disabledLogin = await app.inject({
        method: "POST",
        url: "/admin/auth/login",
        payload: { username: "principal-b", password: resetPassword.json().temporaryPassword }
      });
      expect(disabledLogin.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("prevents a super admin from disabling or downgrading their own account", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const superToken = await adminLogin(app, "super", "super-pass");
      const selfRoleChange = await app.inject({
        method: "PATCH",
        url: "/admin/admin-users/3",
        headers: { authorization: `Bearer ${superToken}` },
        payload: { role: "reviewer" }
      });
      expect(selfRoleChange.statusCode).toBe(400);
      expect(selfRoleChange.json().error.code).toBe("invalid_admin_self_update");

      const selfDelete = await app.inject({
        method: "DELETE",
        url: "/admin/admin-users/3",
        headers: { authorization: `Bearer ${superToken}` }
      });
      expect(selfDelete.statusCode).toBe(400);
      expect(selfDelete.json().error.code).toBe("invalid_admin_self_update");
    } finally {
      await app.close();
    }
  });

  it("scopes reviewer asset review and detail access to the linked principal", async () => {
    const assets = createInMemoryAssetsRepository();
    const own = await assets.createPending({ ...(pendingAssetInput() as ReturnType<typeof pendingAssetInput> & { principalId: string }), principalId: "1", title: "本主理人资产" });
    const other = await assets.createPending({ ...(pendingAssetInput() as ReturnType<typeof pendingAssetInput> & { principalId: string }), principalId: "2", title: "其他主理人资产" });
    const { principalId: _principalId, ...unassignedInput } = pendingAssetInput();
    const unassigned = await assets.createPending({ ...unassignedInput, title: "未分配资产" });
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const reviewerToken = await adminLogin(app, "reviewer", "reviewer-pass");
      const superToken = await adminLogin(app, "super", "super-pass");

      const reviewerList = await app.inject({
        method: "GET",
        url: "/admin/assets/review?page=1&pageSize=1",
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      expect(reviewerList.statusCode).toBe(200);
      expect(reviewerList.json()).toMatchObject({ total: 1, page: 1, pageSize: 1 });
      expect(reviewerList.json().items.map((asset: { id: string }) => asset.id)).toEqual([own.id]);

      const ownDetail = await app.inject({
        method: "GET",
        url: `/admin/assets/${own.id}`,
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      expect(ownDetail.statusCode).toBe(200);

      const otherDetail = await app.inject({
        method: "GET",
        url: `/admin/assets/${other.id}`,
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      expect(otherDetail.statusCode).toBe(404);

      const approveOther = await app.inject({
        method: "POST",
        url: `/admin/assets/${other.id}/approve`,
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      expect(approveOther.statusCode).toBe(404);
      await expect(assets.findById(other.id)).resolves.toMatchObject({ status: "pending_review" });

      const superList = await app.inject({
        method: "GET",
        url: "/admin/assets/review?page=2&pageSize=2",
        headers: { authorization: `Bearer ${superToken}` }
      });
      expect(superList.statusCode).toBe(200);
      expect(superList.json()).toMatchObject({ total: 3, page: 2, pageSize: 2 });
      expect(superList.json().items.map((asset: { id: string }) => asset.id)).toEqual([unassigned.id]);
    } finally {
      await app.close();
    }
  });

  it("scopes reviewer report review actions to reports on linked principal assets", async () => {
    const assets = createInMemoryAssetsRepository();
    const reports = createReportsService();
    const own = await assets.createPending({ ...(pendingAssetInput() as ReturnType<typeof pendingAssetInput> & { principalId: string }), principalId: "1", title: "本主理人举报资产" });
    const other = await assets.createPending({ ...(pendingAssetInput() as ReturnType<typeof pendingAssetInput> & { principalId: string }), principalId: "2", title: "其他主理人举报资产" });
    const ownReport = await reports.createReport({
      reporterUserId: "2",
      targetUserId: "1",
      assetId: own.id,
      reason: "本主理人举报",
      evidence: "截图"
    });
    const otherReport = await reports.createReport({
      reporterUserId: "2",
      targetUserId: "1",
      assetId: other.id,
      reason: "其他主理人举报",
      evidence: "截图"
    });
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets, reportsService: reports });

    try {
      const reviewerToken = await adminLogin(app, "reviewer", "reviewer-pass");

      const list = await app.inject({
        method: "GET",
        url: "/admin/reports?page=1&pageSize=1",
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject({ total: 1, page: 1, pageSize: 1 });
      expect(list.json().items.map((report: { id: string }) => report.id)).toEqual([ownReport.id]);

      const confirmOther = await app.inject({
        method: "POST",
        url: `/admin/reports/${otherReport.id}/confirm`,
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      expect(confirmOther.statusCode).toBe(404);

      const confirmOwn = await app.inject({
        method: "POST",
        url: `/admin/reports/${ownReport.id}/confirm`,
        headers: { authorization: `Bearer ${reviewerToken}` }
      });
      expect(confirmOwn.statusCode).toBe(200);
      expect(confirmOwn.json().report).toMatchObject({ id: ownReport.id, status: "confirmed" });
    } finally {
      await app.close();
    }
  });

  it("requires an admin token to list assets for review", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({ method: "GET", url: "/admin/assets/review" });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("lists pending assets for review from the repository", async () => {
    const assets = createInMemoryAssetsRepository();
    const pending = await assets.createPending(pendingAssetInput());
    const active = await assets.createPending({ ...pendingAssetInput(), title: "已上架资产" });
    await assets.updateStatus(active.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "审核队列卖家" }
      });
      const token = await adminLogin(app, "super", "super-pass");
      const response = await app.inject({
        method: "GET",
        url: "/admin/assets/review",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([
        expect.objectContaining({
          id: pending.id,
          status: "pending_review",
          seller: expect.objectContaining({ id: "1", displayName: "审核队列卖家" })
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("lists all admin assets with filters and pagination", async () => {
    const assets = createInMemoryAssetsRepository();
    await assets.createPending({
      ...pendingAssetInput(),
      gameName: "塔防精灵",
      assetType: "账号",
      title: "待审核账号"
    });
    const activeOne = await assets.createPending({
      ...pendingAssetInput(),
      sellerId: "2",
      gameName: "塔防精灵",
      assetType: "账号",
      title: "塔防账号一"
    });
    await assets.updateStatus(activeOne.id, "active");
    const activeTwo = await assets.createPending({
      ...pendingAssetInput(),
      sellerId: "3",
      gameName: "塔防精灵",
      assetType: "账号",
      title: "塔防账号二"
    });
    await assets.updateStatus(activeTwo.id, "active");
    const equipment = await assets.createPending({
      ...pendingAssetInput(),
      gameName: "塔防精灵",
      assetType: "道具",
      title: "塔防道具"
    });
    await assets.updateStatus(equipment.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "GET",
        url: "/admin/assets?status=active&gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7&page=1&pageSize=1",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        total: 2,
        page: 1,
        pageSize: 1,
        items: [expect.objectContaining({ id: activeTwo.id, status: "active", gameName: "塔防精灵", assetType: "账号" })]
      });
    } finally {
      await app.close();
    }
  });

  it("exports filtered admin asset data as an Excel file within principal scope", async () => {
    const assets = createInMemoryAssetsRepository();
    const own = await assets.createPending({
      ...pendingAssetInput(),
      principalId: "1",
      sellerId: "2",
      gameName: "塔防精灵",
      assetType: "账号",
      title: "可导出账号"
    });
    await assets.updateStatus(own.id, "active");
    const otherPrincipal = await assets.createPending({
      ...pendingAssetInput(),
      principalId: "2",
      sellerId: "3",
      gameName: "塔防精灵",
      assetType: "账号",
      title: "其他主理人账号"
    });
    await assets.updateStatus(otherPrincipal.id, "active");
    const otherType = await assets.createPending({
      ...pendingAssetInput(),
      principalId: "1",
      gameName: "塔防精灵",
      assetType: "道具",
      title: "不匹配类型"
    });
    await assets.updateStatus(otherType.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "GET",
        url: "/admin/assets/export?status=active&gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/vnd.ms-excel");
      expect(response.headers["content-disposition"]).toContain("asset-data");
      expect(response.body).toContain("<?mso-application progid=\"Excel.Sheet\"?>");
      expect(response.body).toContain("可导出账号");
      expect(response.body).toContain("默认主理人");
      expect(response.body).toContain("已上架");
      expect(response.body).not.toContain("其他主理人账号");
      expect(response.body).not.toContain("不匹配类型");
    } finally {
      await app.close();
    }
  });

  it("rejects invalid admin asset status filters", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "GET",
        url: "/admin/assets?status=unknown",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_asset_status");
    } finally {
      await app.close();
    }
  });

  it("requires an admin token to approve assets", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({ method: "POST", url: "/admin/assets/1/approve" });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("allows a reviewer to reject a pending asset with a review note", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending(pendingAssetInput());
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/reject`,
        headers: { authorization: `Bearer ${token}` },
        payload: { note: "截图不完整" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({ id: asset.id, status: "rejected" });
      await expect(admins.listOperations()).resolves.toMatchObject([
        {
          adminId: 1,
          action: "asset.reject",
          targetType: "asset",
          targetId: asset.id,
          detail: { note: "截图不完整" }
        }
      ]);
    } finally {
      await app.close();
    }
  });

  it("rejects operator approval without asset review permission", async () => {
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending({ ...pendingAssetInput(), principalId: "2" });
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "operator", "operator-pass");
      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("allows a reviewer to approve a pending asset", async () => {
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending(pendingAssetInput());
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset.status).toBe("active");
      await expect(assets.findById(asset.id)).resolves.toMatchObject({ status: "active" });
    } finally {
      await app.close();
    }
  });

  it("allows a reviewer to batch approve pending assets and reports invalid rows", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const first = await assets.createPending(pendingAssetInput());
    const second = await assets.createPending({ ...pendingAssetInput(), title: "70级角色" });
    const alreadyActive = await assets.createPending({ ...pendingAssetInput(), title: "已上架角色" });
    await assets.updateStatus(alreadyActive.id, "active");
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: "/admin/assets/review/batch",
        headers: { authorization: `Bearer ${token}` },
        payload: { action: "approve", assetIds: [first.id, second.id, alreadyActive.id] }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().succeeded.map((asset: { id: string; status: string }) => [asset.id, asset.status])).toEqual([
        [first.id, "active"],
        [second.id, "active"]
      ]);
      expect(response.json().failed).toEqual([
        {
          assetId: alreadyActive.id,
          code: "invalid_asset_state",
          message: "Only pending review assets can be approved"
        }
      ]);
      await expect(admins.listOperations()).resolves.toMatchObject([
        { adminId: 1, action: "asset.approve", targetType: "asset", targetId: first.id },
        { adminId: 1, action: "asset.approve", targetType: "asset", targetId: second.id }
      ]);
    } finally {
      await app.close();
    }
  });

  it("allows a reviewer to batch reject pending assets with a shared note", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const first = await assets.createPending(pendingAssetInput());
    const second = await assets.createPending({ ...pendingAssetInput(), title: "70级角色" });
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: "/admin/assets/review/batch",
        headers: { authorization: `Bearer ${token}` },
        payload: { action: "reject", assetIds: [first.id, second.id], note: "批量资料不完整" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().succeeded.map((asset: { id: string; status: string }) => [asset.id, asset.status])).toEqual([
        [first.id, "rejected"],
        [second.id, "rejected"]
      ]);
      expect(response.json().failed).toEqual([]);
      await expect(admins.listOperations()).resolves.toMatchObject([
        {
          adminId: 1,
          action: "asset.reject",
          targetType: "asset",
          targetId: first.id,
          detail: { note: "批量资料不完整" }
        },
        {
          adminId: 1,
          action: "asset.reject",
          targetType: "asset",
          targetId: second.id,
          detail: { note: "批量资料不完整" }
        }
      ]);
    } finally {
      await app.close();
    }
  });

  it("allows an operator to remove an active asset so it cannot be listed or bid on", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending({ ...pendingAssetInput(), principalId: "2" });
    await assets.updateStatus(asset.id, "active");
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    try {
      const operator = await adminLogin(app, "operator", "operator-pass");
      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/remove`,
        headers: { authorization: `Bearer ${operator}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({ id: asset.id, status: "removed" });
      await expect(admins.listOperations()).resolves.toMatchObject([
        { adminId: 2, action: "asset.remove", targetType: "asset", targetId: asset.id }
      ]);

      const list = await app.inject({ method: "GET", url: "/api/assets" });
      expect(list.json().items).toEqual([]);

      const bidder = await userLogin(app);
      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidder}` },
        payload: { assetId: asset.id, amountCents: 10000, commitmentAccepted: true }
      });
      expect(bid.statusCode).toBe(400);
      expect(bid.json().error.code).toBe("asset_not_active");
    } finally {
      await app.close();
    }
  });

  it("lets a scoped admin update the deadline of an unfinished asset", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const own = await assets.createPending({ ...pendingAssetInput(), principalId: "1", title: "可修改截止时间资产" });
    const other = await assets.createPending({ ...pendingAssetInput(), principalId: "2", title: "其他主理人资产" });
    const ended = await assets.createPending({ ...pendingAssetInput(), principalId: "1", title: "已结束资产" });
    const activeOwn = await assets.updateStatus(own.id, "active");
    await assets.updateStatus(other.id, "active");
    await assets.save({ ...ended, status: "ended" });
    const nextEndAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    try {
      const reviewer = await adminLogin(app, "reviewer", "reviewer-pass");
      const updateOther = await app.inject({
        method: "POST",
        url: `/admin/assets/${other.id}/end-time`,
        headers: { authorization: `Bearer ${reviewer}` },
        payload: { endAt: nextEndAt }
      });
      const updateEnded = await app.inject({
        method: "POST",
        url: `/admin/assets/${ended.id}/end-time`,
        headers: { authorization: `Bearer ${reviewer}` },
        payload: { endAt: nextEndAt }
      });
      const updateOwn = await app.inject({
        method: "POST",
        url: `/admin/assets/${own.id}/end-time`,
        headers: { authorization: `Bearer ${reviewer}` },
        payload: { endAt: nextEndAt }
      });

      expect(updateOther.statusCode).toBe(404);
      expect(updateEnded.statusCode).toBe(400);
      expect(updateEnded.json().error.code).toBe("invalid_asset_state");
      expect(updateOwn.statusCode).toBe(200);
      expect(updateOwn.json().asset).toMatchObject({
        id: own.id,
        originalEndAt: nextEndAt,
        effectiveEndAt: nextEndAt
      });
      await expect(assets.findById(own.id)).resolves.toMatchObject({
        originalEndAt: nextEndAt,
        effectiveEndAt: nextEndAt
      });
      await expect(admins.listOperations()).resolves.toEqual([
        expect.objectContaining({
          adminId: 1,
          action: "asset.end_time_update",
          targetType: "asset",
          targetId: own.id,
          detail: {
            previousOriginalEndAt: activeOwn.originalEndAt,
            previousEffectiveEndAt: activeOwn.effectiveEndAt,
            endAt: nextEndAt
          }
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("allows a principal reviewer to confirm a bid asset as sold so buyers cannot keep bidding", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const own = await assets.createPending({ ...pendingAssetInput(), principalId: "1", title: "主理人确认成交资产" });
    const other = await assets.createPending({ ...pendingAssetInput(), principalId: "2", title: "其他主理人资产" });
    const activeOwn = await assets.updateStatus(own.id, "active");
    await assets.updateStatus(other.id, "active");
    await assets.save({ ...activeOwn, currentPriceCents: 10000, highestBidderId: "2" });
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    try {
      const reviewer = await adminLogin(app, "reviewer", "reviewer-pass");
      const confirmOther = await app.inject({
        method: "POST",
        url: `/admin/assets/${other.id}/confirm-deal`,
        headers: { authorization: `Bearer ${reviewer}` }
      });
      const confirmOwn = await app.inject({
        method: "POST",
        url: `/admin/assets/${own.id}/confirm-deal`,
        headers: { authorization: `Bearer ${reviewer}` }
      });

      expect(confirmOther.statusCode).toBe(404);
      expect(confirmOwn.statusCode).toBe(200);
      expect(confirmOwn.json().asset).toMatchObject({ id: own.id, status: "ended", currentPriceCents: 10000, highestBidderId: "2" });
      const followupList = await app.inject({
        method: "GET",
        url: "/admin/deal-followups",
        headers: { authorization: `Bearer ${reviewer}` }
      });
      expect(followupList.json().items).toEqual([
        expect.objectContaining({
          assetId: own.id,
          status: "completed",
          completedAt: expect.any(String),
          note: "主理人完成交易"
        })
      ]);
      await expect(admins.listOperations()).resolves.toMatchObject([
        { adminId: 1, action: "asset.confirm_deal", targetType: "asset", targetId: own.id }
      ]);

      const list = await app.inject({ method: "GET", url: "/api/assets" });
      expect(list.json().items.map((asset: { id: string }) => asset.id)).not.toContain(own.id);

      const bidder = await userLogin(app);
      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidder}` },
        payload: { assetId: own.id, amountCents: 10000, commitmentAccepted: true }
      });
      expect(bid.statusCode).toBe(400);
      expect(bid.json().error.code).toBe("asset_not_active");
    } finally {
      await app.close();
    }
  });

  it("lets a principal reviewer revoke one suspicious bid, restrict the bidder, and release the restriction", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    async function login(displayName: string) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName }
      });
      return { token: response.json().token as string, userId: response.json().user.id as string };
    }

    try {
      const seller = await login("卖家");
      const firstBidder = await login("正常买家");
      const suspiciousBidder = await login("疑似抬价买家");
      const asset = await assets.createPending({ ...pendingAssetInput(), sellerId: seller.userId, principalId: "1" });
      await assets.updateStatus(asset.id, "active");
      const reviewer = await adminLogin(app, "reviewer", "reviewer-pass");

      await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${firstBidder.token}` },
        payload: { assetId: asset.id, amountCents: 10000, commitmentAccepted: true }
      });
      const suspiciousBid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${suspiciousBidder.token}` },
        payload: { assetId: asset.id, amountCents: 10100, commitmentAccepted: true }
      });
      expect(suspiciousBid.statusCode).toBe(200);

      const revoked = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/bids/${suspiciousBid.json().bid.id}/revoke-and-restrict`,
        headers: { authorization: `Bearer ${reviewer}` },
        payload: { duration: "30m", reason: "疑似故意抬价" }
      });

      expect(revoked.statusCode).toBe(200);
      expect(revoked.json().asset).toMatchObject({
        id: asset.id,
        currentPriceCents: 10000,
        highestBidderId: firstBidder.userId
      });
      expect(revoked.json().bid).toMatchObject({
        id: suspiciousBid.json().bid.id,
        bidderId: suspiciousBidder.userId,
        revokedAt: expect.any(String),
        revokeReason: "疑似故意抬价"
      });
      expect(revoked.json().user).toMatchObject({
        id: suspiciousBidder.userId,
        bidRestrictedUntil: expect.any(String),
        bidRestrictionPermanent: false,
        bidRestrictionReason: "疑似故意抬价"
      });

      const rejectedBid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${suspiciousBidder.token}` },
        payload: { assetId: asset.id, amountCents: 10100, commitmentAccepted: true }
      });
      expect(rejectedBid.statusCode).toBe(403);
      expect(rejectedBid.json().error).toMatchObject({
        code: "bid_restricted",
        details: {
          bidRestrictedUntil: expect.any(String),
          permanent: false,
          reason: "疑似故意抬价"
        }
      });

      const released = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/bidders/${suspiciousBidder.userId}/bid-restriction/release`,
        headers: { authorization: `Bearer ${reviewer}` }
      });
      expect(released.statusCode).toBe(200);
      expect(released.json().user).toMatchObject({
        id: suspiciousBidder.userId,
        bidRestrictedUntil: null,
        bidRestrictionPermanent: false,
        bidRestrictionReason: null
      });

      const nextBid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${suspiciousBidder.token}` },
        payload: { assetId: asset.id, amountCents: 10100, commitmentAccepted: true }
      });
      expect(nextBid.statusCode).toBe(200);
      expect(nextBid.json().asset).toMatchObject({ currentPriceCents: 10100, highestBidderId: suspiciousBidder.userId });
      await expect(admins.listOperations()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: "bid.revoke_and_restrict", targetType: "bid", targetId: suspiciousBid.json().bid.id }),
          expect.objectContaining({ action: "user.release_bid_restriction", targetType: "user", targetId: suspiciousBidder.userId })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("blocks operator bid revocation and supports super admin release from the user list", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    async function login(displayName: string) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName }
      });
      return { token: response.json().token as string, userId: response.json().user.id as string };
    }

    try {
      const seller = await login("卖家");
      const bidder = await login("永久限制买家");
      const asset = await assets.createPending({ ...pendingAssetInput(), sellerId: seller.userId, principalId: "1" });
      await assets.updateStatus(asset.id, "active");
      const bid = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidder.token}` },
        payload: { assetId: asset.id, amountCents: 10000, commitmentAccepted: true }
      });
      const operator = await adminLogin(app, "operator", "operator-pass");
      const reviewer = await adminLogin(app, "reviewer", "reviewer-pass");
      const superAdmin = await adminLogin(app, "super", "super-pass");

      const rejected = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/bids/${bid.json().bid.id}/revoke-and-restrict`,
        headers: { authorization: `Bearer ${operator}` },
        payload: { duration: "permanent", reason: "疑似故意抬价" }
      });
      expect(rejected.statusCode).toBe(403);

      const restricted = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/bids/${bid.json().bid.id}/revoke-and-restrict`,
        headers: { authorization: `Bearer ${reviewer}` },
        payload: { duration: "permanent", reason: "疑似故意抬价" }
      });
      expect(restricted.statusCode).toBe(200);
      expect(restricted.json().user).toMatchObject({ bidRestrictionPermanent: true, bidRestrictedUntil: null });

      const blocked = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${bidder.token}` },
        payload: { assetId: asset.id, amountCents: 10000, commitmentAccepted: true }
      });
      expect(blocked.statusCode).toBe(403);
      expect(blocked.json().error.details).toMatchObject({ permanent: true, reason: "疑似故意抬价" });

      const released = await app.inject({
        method: "POST",
        url: `/admin/users/${bidder.userId}/bid-restriction/release`,
        headers: { authorization: `Bearer ${superAdmin}` }
      });
      expect(released.statusCode).toBe(200);
      expect(released.json().user).toMatchObject({ bidRestrictionPermanent: false, bidRestrictionReason: null });
    } finally {
      await app.close();
    }
  });

  it("keeps a completed asset ended when deal followup synchronization fails", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const baseFollowups = createInMemoryDealFollowupsRepository();
    const failingFollowups: DealFollowupsRepository = {
      ...baseFollowups,
      async ensureForSoldAsset() {
        throw new Error("followup sync failed");
      }
    };
    const created = await assets.createPending({ ...pendingAssetInput(), principalId: "1", title: "跟进同步失败资产" });
    const active = await assets.updateStatus(created.id, "active");
    await assets.save({ ...active, currentPriceCents: 10000, highestBidderId: "2" });
    const app = buildApp({
      enableMockAuth: true,
      adminRepository: admins,
      assetsRepository: assets,
      dealFollowupsRepository: failingFollowups
    });

    try {
      const reviewer = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${created.id}/confirm-deal`,
        headers: { authorization: `Bearer ${reviewer}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset).toMatchObject({ id: created.id, status: "ended" });
      await expect(assets.findById(created.id)).resolves.toMatchObject({ id: created.id, status: "ended" });
      await expect(admins.listOperations()).resolves.toEqual([
        expect.objectContaining({
          adminId: 1,
          action: "asset.confirm_deal",
          targetType: "asset",
          targetId: created.id,
          detail: expect.objectContaining({
            followupId: null,
            status: "completed",
            followupSyncError: "followup sync failed"
          })
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("allows an operator to batch remove active assets and reports invalid rows", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const first = await assets.createPending({ ...pendingAssetInput(), principalId: "2", title: "批量下架资产A" });
    const second = await assets.createPending({ ...pendingAssetInput(), principalId: "2", title: "批量下架资产B" });
    const pending = await assets.createPending({ ...pendingAssetInput(), principalId: "2", title: "待审核资产" });
    await assets.updateStatus(first.id, "active");
    await assets.updateStatus(second.id, "active");
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    try {
      const operator = await adminLogin(app, "operator", "operator-pass");
      const response = await app.inject({
        method: "POST",
        url: "/admin/assets/remove/batch",
        headers: { authorization: `Bearer ${operator}` },
        payload: { assetIds: [first.id, second.id, pending.id] }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().succeeded.map((asset: { id: string; status: string }) => [asset.id, asset.status])).toEqual([
        [first.id, "removed"],
        [second.id, "removed"]
      ]);
      expect(response.json().failed).toEqual([
        {
          assetId: pending.id,
          code: "invalid_asset_state",
          message: "Only active assets can be removed"
        }
      ]);
      await expect(admins.listOperations()).resolves.toMatchObject([
        { adminId: 2, action: "asset.remove", targetType: "asset", targetId: first.id },
        { adminId: 2, action: "asset.remove", targetType: "asset", targetId: second.id }
      ]);
    } finally {
      await app.close();
    }
  });

  it("allows a reviewer to approve a pending asset when an empty JSON body is sent", async () => {
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending(pendingAssetInput());
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().asset.status).toBe("active");
    } finally {
      await app.close();
    }
  });

  it("logs the approving reviewer admin id", async () => {
    const admins = createInMemoryAdminRepository();
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending(pendingAssetInput());
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      await expect(admins.listOperations()).resolves.toMatchObject([
        { adminId: 1, action: "asset.approve", targetType: "asset", targetId: asset.id }
      ]);
    } finally {
      await app.close();
    }
  });

  it("allows a principal reviewer to deduct five credit points for a violating asset", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const sellerLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "违规卖家" }
      });
      const sellerId = sellerLogin.json().user.id as string;
      const asset = await assets.createPending({ ...pendingAssetInput(), sellerId, title: "违规资产" });
      const assetId = asset.id;
      const reviewerToken = await adminLogin(app, "reviewer", "reviewer-pass");

      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${assetId}/deduct-credit`,
        headers: { authorization: `Bearer ${reviewerToken}` },
        payload: { reason: "审核发现违规信息" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user).toMatchObject({
        id: sellerId,
        creditScore: 95,
        violationCount: 1
      });
    } finally {
      await app.close();
    }
  });

  it("rejects approving assets that are already active", async () => {
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending(pendingAssetInput());
    await assets.updateStatus(asset.id, "active");
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_asset_state");
    } finally {
      await app.close();
    }
  });

  it("rejects a user token on admin routes", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await userLogin(app);
      const response = await app.inject({
        method: "GET",
        url: "/admin/assets/review",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("rejects a token after the admin is disabled", async () => {
    const admins = createInMemoryAdminRepository();
    const app = buildApp({ enableMockAuth: true, adminRepository: admins });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      admins.disableAdmin(1);

      const response = await app.inject({
        method: "GET",
        url: "/admin/assets/review",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("rejects a token after the admin role loses asset review permission", async () => {
    const admins = createInMemoryAdminRepository();
    const app = buildApp({ enableMockAuth: true, adminRepository: admins });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      admins.setRole(1, "operator");

      const response = await app.inject({
        method: "GET",
        url: "/admin/assets/review",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("lists users for admin management with keyword filtering", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      await app.inject({ method: "POST", url: "/api/auth/mock-login", payload: { displayName: "普通卖家" } });
      const targetLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "目标买家" }
      });
      const token = await adminLogin(app, "super", "super-pass");

      const response = await app.inject({
        method: "GET",
        url: "/admin/users?q=目标",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          expect.objectContaining({
            id: targetLogin.json().user.id,
            displayName: "目标买家",
            banned: false,
            violationCount: 0
          })
        ],
        total: 1,
        page: 1,
        pageSize: 20
      });
    } finally {
      await app.close();
    }
  });

  it("paginates front user management rows", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      await app.inject({ method: "POST", url: "/api/auth/mock-login", payload: { displayName: "前台用户A" } });
      await app.inject({ method: "POST", url: "/api/auth/mock-login", payload: { displayName: "前台用户B" } });
      await app.inject({ method: "POST", url: "/api/auth/mock-login", payload: { displayName: "前台用户C" } });
      const token = await adminLogin(app, "super", "super-pass");

      const response = await app.inject({
        method: "GET",
        url: "/admin/users?page=2&pageSize=2",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ total: 3, page: 2, pageSize: 2 });
      expect(response.json().items.map((user: { displayName: string }) => user.displayName)).toEqual(["前台用户A"]);
    } finally {
      await app.close();
    }
  });

  it("defaults the asset data list to active and pending review assets by newest created time", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const sellerLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "资产数据卖家" }
      });
      const sellerId = sellerLogin.json().user.id as string;
      const adminToken = await adminLogin(app, "super", "super-pass");
      const baseTime = Date.now();
      const oldPending = await assets.createPending({ ...pendingAssetInput(), sellerId, title: "较早待审核资产" });
      const active = await assets.createPending({ ...pendingAssetInput(), sellerId, title: "已上架资产" });
      const rejected = await assets.createPending({ ...pendingAssetInput(), sellerId, title: "已拒绝资产" });
      const newestPending = await assets.createPending({ ...pendingAssetInput(), sellerId, title: "最新待审核资产" });
      await assets.save({ ...oldPending, createdAt: new Date(baseTime).toISOString() });
      const activeRow = await assets.updateStatus(active.id, "active");
      await assets.save({ ...activeRow, createdAt: new Date(baseTime + 1000).toISOString() });
      const rejectedRow = await assets.updateStatus(rejected.id, "rejected");
      await assets.save({ ...rejectedRow, createdAt: new Date(baseTime + 2000).toISOString() });
      await assets.save({ ...newestPending, createdAt: new Date(baseTime + 3000).toISOString() });

      const response = await app.inject({
        method: "GET",
        url: "/admin/assets",
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        total: 3,
        items: [
          expect.objectContaining({ id: newestPending.id, status: "pending_review" }),
          expect.objectContaining({ id: active.id, status: "active" }),
          expect.objectContaining({ id: oldPending.id, status: "pending_review" })
        ]
      });
      expect(response.json().items.map((asset: { id: string }) => asset.id)).not.toContain(rejected.id);
    } finally {
      await app.close();
    }
  });

  it("lists a user created by WeChat login in admin user management", async () => {
    const app = buildApp({
      enableMockAuth: false,
      wechatCodeSessionExchanger: async (code: string) => {
        expect(code).toBe("wx-front-user-code");
        return { openid: "openid-front-user" };
      }
    } as Parameters<typeof buildApp>[0]);

    try {
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/wechat-login",
        payload: {
          code: "wx-front-user-code",
          displayName: "微信前台用户",
          avatarUrl: "https://example.com/front-user.png"
        }
      });
      expect(login.statusCode).toBe(200);

      const token = await adminLogin(app, "super", "super-pass");
      const response = await app.inject({
        method: "GET",
        url: "/admin/users?q=%E5%BE%AE%E4%BF%A1%E5%89%8D%E5%8F%B0",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          expect.objectContaining({
            id: login.json().user.id,
            displayName: "微信前台用户",
            avatarUrl: "https://example.com/front-user.png",
            banned: false,
            violationCount: 0
          })
        ],
        total: 1,
        page: 1,
        pageSize: 20
      });
    } finally {
      await app.close();
    }
  });

  it("allows a super admin to ban and unban a user", async () => {
    const admins = createInMemoryAdminRepository();
    const app = buildApp({ enableMockAuth: true, adminRepository: admins });

    try {
      const userLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "违规用户" }
      });
      const userId = userLogin.json().user.id as string;
      const token = await adminLogin(app, "super", "super-pass");

      const banned = await app.inject({
        method: "POST",
        url: `/admin/users/${userId}/ban`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: "线下交易违约" }
      });
      expect(banned.statusCode).toBe(200);
      expect(banned.json().user).toMatchObject({
        id: userId,
        banned: true,
        banReason: "线下交易违约"
      });

      const unbanned = await app.inject({
        method: "POST",
        url: `/admin/users/${userId}/unban`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(unbanned.statusCode).toBe(200);
      expect(unbanned.json().user).toMatchObject({
        id: userId,
        banned: false,
        banReason: null
      });

      await expect(admins.listOperations()).resolves.toEqual([
        expect.objectContaining({ action: "user.ban", targetType: "user", targetId: userId }),
        expect.objectContaining({ action: "user.unban", targetType: "user", targetId: userId })
      ]);
    } finally {
      await app.close();
    }
  });

  it("allows a super admin to set and clear a user's daily publish limit", async () => {
    const admins = createInMemoryAdminRepository();
    const app = buildApp({ enableMockAuth: true, adminRepository: admins });

    try {
      const userLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "高频卖家" }
      });
      const userId = userLogin.json().user.id as string;
      const token = await adminLogin(app, "super", "super-pass");

      const limited = await app.inject({
        method: "POST",
        url: `/admin/users/${userId}/publish-limit`,
        headers: { authorization: `Bearer ${token}` },
        payload: { limit: 5 }
      });
      expect(limited.statusCode).toBe(200);
      expect(limited.json().user).toMatchObject({
        id: userId,
        dailyPublishLimit: 5
      });

      const listed = await app.inject({
        method: "GET",
        url: "/admin/users?q=%E9%AB%98%E9%A2%91",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(listed.json().items).toEqual([
        expect.objectContaining({
          id: userId,
          dailyPublishLimit: 5
        })
      ]);

      const cleared = await app.inject({
        method: "POST",
        url: `/admin/users/${userId}/publish-limit`,
        headers: { authorization: `Bearer ${token}` },
        payload: { limit: null }
      });
      expect(cleared.statusCode).toBe(200);
      expect(cleared.json().user).toMatchObject({
        id: userId,
        dailyPublishLimit: null
      });

      await expect(admins.listOperations()).resolves.toEqual([
        expect.objectContaining({
          action: "user.set_publish_limit",
          targetType: "user",
          targetId: userId,
          detail: { limit: 5 }
        }),
        expect.objectContaining({
          action: "user.set_publish_limit",
          targetType: "user",
          targetId: userId,
          detail: { limit: null }
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("rejects operator user bans without user ban permission", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const userLogin = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "待处理用户" }
      });
      const token = await adminLogin(app, "operator", "operator-pass");

      const response = await app.inject({
        method: "POST",
        url: `/admin/users/${userLogin.json().user.id}/ban`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: "测试" }
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("lists and updates system configs for super admins", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "super", "super-pass");
      const list = await app.inject({
        method: "GET",
        url: "/admin/configs?page=1&pageSize=3",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject({ total: 6, page: 1, pageSize: 3 });
      expect(list.json().items).toEqual([
        expect.objectContaining({ key: "default_min_increment_cents", value: "100" }),
        expect.objectContaining({ key: "extension_window_seconds", value: "300" }),
        expect.objectContaining({ key: "extension_duration_seconds", value: "300" })
      ]);

      const updated = await app.inject({
        method: "POST",
        url: "/admin/configs/default_min_increment_cents",
        headers: { authorization: `Bearer ${token}` },
        payload: { value: "200" }
      });

      expect(updated.statusCode).toBe(200);
      expect(updated.json().config).toMatchObject({
        key: "default_min_increment_cents",
        value: "200",
        updatedBy: 3
      });
    } finally {
      await app.close();
    }
  });

  it("rejects reviewer config updates without config manage permission", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: "/admin/configs/default_min_increment_cents",
        headers: { authorization: `Bearer ${token}` },
        payload: { value: "200" }
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("rolls asset approval back when operation logging fails", async () => {
    const baseAdmins = createInMemoryAdminRepository();
    const admins: AdminRepository = {
      async findByUsername(username: string): Promise<AdminUserRow | null> {
        return baseAdmins.findByUsername(username);
      },
      async findById(id: number): Promise<AdminUserRow | null> {
        return baseAdmins.findById(id);
      },
      async list(): Promise<AdminUserRow[]> {
        return baseAdmins.list();
      },
      async create(input) {
        return baseAdmins.create(input);
      },
      async update(id, input) {
        return baseAdmins.update(id, input);
      },
      async softDelete(id) {
        return baseAdmins.softDelete(id);
      },
      async logOperation(_input: AdminOperationLog): Promise<void> {
        throw new Error("Log failed");
      }
    };
    const assets = createInMemoryAssetsRepository();
    const asset = await assets.createPending(pendingAssetInput());
    const app = buildApp({ enableMockAuth: true, adminRepository: admins, assetsRepository: assets });

    try {
      const token = await adminLogin(app, "reviewer", "reviewer-pass");
      const response = await app.inject({
        method: "POST",
        url: `/admin/assets/${asset.id}/approve`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(500);
      await expect(assets.findById(asset.id)).resolves.toMatchObject({ status: "pending_review" });
    } finally {
      await app.close();
    }
  });
});
