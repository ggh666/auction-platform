import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildApp } from "../../api/src/app";
import { createInMemoryAdminRepository } from "../../api/src/modules/admin/admin.repository";
import { createInMemoryAssetFollowsRepository } from "../../api/src/modules/assetFollows/assetFollows.repository";
import { createInMemoryAssetsRepository } from "../../api/src/modules/assets/assets.repository";
import { createInMemoryBidsRepository } from "../../api/src/modules/bids/bids.repository";
import { createInMemoryImageSafetyRepository } from "../../api/src/modules/contentSafety/imageSafety.repository";
import { createInMemorySystemConfigsRepository } from "../../api/src/modules/configs/configs.repository";
import { createInMemoryDealFollowupsRepository } from "../../api/src/modules/dealFollowups/dealFollowups.repository";
import { createInMemoryNotificationsRepository } from "../../api/src/modules/notifications/notifications.repository";
import { createInMemoryPrincipalsRepository } from "../../api/src/modules/principals/principals.repository";
import { createReportsService } from "../../api/src/modules/reports/reports.service";
import { createInMemoryUsersRepository } from "../../api/src/modules/users/users.repository";

const invalidDisplayNameError = {
  error: { code: "invalid_display_name", message: "Display name is required" }
};

const productionEnv = {
  NODE_ENV: "production",
  JWT_SECRET: "production-secret",
  MYSQL_URI: "mysql://auction:secret@db.example.com:3306/auction_platform",
  R2_ENDPOINT: "https://r2.example.com",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET: "auction-assets-prod",
  WECHAT_APPID: "wx-test-appid",
  WECHAT_APP_SECRET: "wx-test-secret",
  WECHAT_EVENT_TOKEN: "event-token"
};

function wechatProfileSignature(rawData: string, sessionKey: string) {
  return createHash("sha1").update(`${rawData}${sessionKey}`).digest("hex");
}

function buildProductionTestApp() {
  const assetsRepository = createInMemoryAssetsRepository();
  return buildApp({
    enableMockAuth: true,
    env: productionEnv,
    usersRepository: createInMemoryUsersRepository(),
    assetsRepository,
    adminRepository: createInMemoryAdminRepository(),
    bidsRepository: createInMemoryBidsRepository((asset) => assetsRepository.save(asset)),
    reportsService: createReportsService(),
    assetFollowsRepository: createInMemoryAssetFollowsRepository(),
    principalsRepository: createInMemoryPrincipalsRepository(),
    configsRepository: createInMemorySystemConfigsRepository(),
    notificationsRepository: createInMemoryNotificationsRepository(),
    dealFollowupsRepository: createInMemoryDealFollowupsRepository(),
    imageSafetyRepository: createInMemoryImageSafetyRepository()
  });
}

describe("auth routes", () => {
  it("creates a mock session in development", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "测试用户" }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.token).toEqual(expect.any(String));
      expect(body.user.displayName).toBe("测试用户");
      expect(body.user.banned).toBe(false);
    } finally {
      await app.close();
    }
  });

  it("issues expiring user tokens", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "有时效登录用户" }
      });
      const payload = app.jwt.decode(response.json().token) as { exp?: number; iat?: number; kind?: string };

      expect(payload.kind).toBe("user");
      expect(typeof payload.iat).toBe("number");
      expect(typeof payload.exp).toBe("number");
      expect(payload.exp as number).toBeGreaterThan(payload.iat as number);
      expect((payload.exp as number) - (payload.iat as number)).toBeLessThanOrEqual(30 * 24 * 60 * 60);
    } finally {
      await app.close();
    }
  });

  it("returns the current profile for a user token", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "Profile User" }
      });
      const token = loginResponse.json().token;

      const response = await app.inject({
        method: "GET",
        url: "/api/profile/me",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        user: {
          id: "1",
          displayName: "Profile User",
          banned: false,
          violationCount: 0,
          creditScore: 100,
          creditResetAt: null,
          buyerUnreachableCount: 0,
          bidRestrictedUntil: null,
          bidRestrictionPermanent: false,
          bidRestrictionReason: null,
          bidRestrictionStartedAt: null
        }
      });
    } finally {
      await app.close();
    }
  });

  it("resets credit score to 100 after three months", async () => {
    const users = createInMemoryUsersRepository({
      now: () => new Date("2026-01-01T00:00:00.000Z")
    });
    const app = buildApp({ enableMockAuth: true, usersRepository: users });

    try {
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "信誉恢复用户" }
      });
      const token = loginResponse.json().token;
      await users.deductCreditScore(1, 35);
      users.setNow(() => new Date("2026-04-02T00:00:00.000Z"));

      const response = await app.inject({
        method: "GET",
        url: "/api/profile/me",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user).toMatchObject({
        id: "1",
        creditScore: 100,
        creditResetAt: null,
        violationCount: 1
      });
    } finally {
      await app.close();
    }
  });

  it("creates a user session from a WeChat login code", async () => {
    const app = buildApp({
      enableMockAuth: false,
      wechatCodeSessionExchanger: async (code: string) => {
        expect(code).toBe("wx-code-1");
        return { openid: "openid-123" };
      }
    } as Parameters<typeof buildApp>[0]);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/wechat-login",
        payload: {
          code: "wx-code-1",
          displayName: "微信买家",
          avatarUrl: "https://example.com/avatar.png"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.token).toEqual(expect.any(String));
      expect(body.user).toMatchObject({
        id: "1",
        displayName: "微信买家",
        avatarUrl: "https://example.com/avatar.png",
        banned: false,
        violationCount: 0
      });

      const profile = await app.inject({
        method: "GET",
        url: "/api/profile/me",
        headers: { authorization: `Bearer ${body.token}` }
      });

      expect(profile.statusCode).toBe(200);
      expect(profile.json().user).toMatchObject(body.user);
    } finally {
      await app.close();
    }
  });

  it("uses signed WeChat profile data for the display name instead of mutable request fields", async () => {
    const sessionKey = "session-key-1";
    const profileRawData = JSON.stringify({
      nickName: "微信原始昵称",
      avatarUrl: "https://example.com/wechat-avatar.png"
    });
    const app = buildApp({
      enableMockAuth: false,
      wechatCodeSessionExchanger: async (code: string) => {
        expect(code).toBe("wx-code-2");
        return { openid: "openid-verified", sessionKey };
      }
    } as Parameters<typeof buildApp>[0]);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/wechat-login",
        payload: {
          code: "wx-code-2",
          displayName: "客户端伪造昵称",
          avatarUrl: "https://example.com/fake-avatar.png",
          profileRawData,
          profileSignature: wechatProfileSignature(profileRawData, sessionKey)
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user).toMatchObject({
        displayName: "微信原始昵称",
        avatarUrl: "https://example.com/wechat-avatar.png"
      });
    } finally {
      await app.close();
    }
  });

  it("rejects tampered WeChat profile data", async () => {
    const app = buildApp({
      enableMockAuth: false,
      wechatCodeSessionExchanger: async () => ({ openid: "openid-tampered", sessionKey: "session-key-2" })
    } as Parameters<typeof buildApp>[0]);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/wechat-login",
        payload: {
          code: "wx-code-3",
          profileRawData: JSON.stringify({ nickName: "篡改昵称" }),
          profileSignature: "bad-signature"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: "invalid_wechat_profile", message: "WeChat profile signature is invalid" }
      });
    } finally {
      await app.close();
    }
  });

  it("rejects protected routes without a bearer token", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({ method: "GET", url: "/api/profile/me" });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("rejects protected routes with a non-user token", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      await app.ready();
      const token = app.jwt.sign({ adminId: "1", kind: "admin" });
      const response = await app.inject({
        method: "GET",
        url: "/api/profile/me",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("returns 404 when mock login is disabled", async () => {
    const app = buildApp({ enableMockAuth: false });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "测试用户" }
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("rejects non-string display names", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: 123 }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(invalidDisplayNameError);
    } finally {
      await app.close();
    }
  });

  it("rejects whitespace display names", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "   " }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(invalidDisplayNameError);
    } finally {
      await app.close();
    }
  });

  it("forces mock login off in production", async () => {
    const app = buildProductionTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/mock-login",
        payload: { displayName: "测试用户" }
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
