import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import { readEnv } from "../../api/src/config/env";
import { HttpError } from "../../api/src/http/errors";
import { createRequestTimingHooks } from "../../api/src/observability/requestTiming";
import { createInMemoryAdminRepository } from "../../api/src/modules/admin/admin.repository";
import { createInMemoryAssetConversationsRepository } from "../../api/src/modules/assetConversations/assetConversations.repository";
import { createInMemoryAssetFollowsRepository } from "../../api/src/modules/assetFollows/assetFollows.repository";
import { createInMemoryAssetsRepository } from "../../api/src/modules/assets/assets.repository";
import { createInMemoryBidsRepository } from "../../api/src/modules/bids/bids.repository";
import { createInMemoryImageSafetyRepository } from "../../api/src/modules/contentSafety/imageSafety.repository";
import { createInMemorySystemConfigsRepository } from "../../api/src/modules/configs/configs.repository";
import { createInMemoryDealFollowupsRepository } from "../../api/src/modules/dealFollowups/dealFollowups.repository";
import { createInMemoryDragonBallPriceReferencesRepository } from "../../api/src/modules/dragonBallPriceReferences/dragonBallPriceReferences.repository";
import { createInMemoryExchangeResourcesRepository } from "../../api/src/modules/exchangeResources/exchangeResources.repository";
import { createInMemoryNotificationsRepository } from "../../api/src/modules/notifications/notifications.repository";
import { createInMemoryPrincipalsRepository } from "../../api/src/modules/principals/principals.repository";
import { createReportsService } from "../../api/src/modules/reports/reports.service";
import { createInMemoryUsersRepository } from "../../api/src/modules/users/users.repository";

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

function buildProductionApp(env: NodeJS.ProcessEnv = productionEnv) {
  const assetsRepository = createInMemoryAssetsRepository();
  return buildApp({
    env,
    usersRepository: createInMemoryUsersRepository(),
    assetsRepository,
    adminRepository: createInMemoryAdminRepository(),
    bidsRepository: createInMemoryBidsRepository((asset) => assetsRepository.save(asset)),
    reportsService: createReportsService(),
    assetFollowsRepository: createInMemoryAssetFollowsRepository(),
    assetConversationsRepository: createInMemoryAssetConversationsRepository(),
    principalsRepository: createInMemoryPrincipalsRepository(),
    configsRepository: createInMemorySystemConfigsRepository(),
    notificationsRepository: createInMemoryNotificationsRepository(),
    dealFollowupsRepository: createInMemoryDealFollowupsRepository(),
    exchangeResourcesRepository: createInMemoryExchangeResourcesRepository(),
    dragonBallPriceReferencesRepository: createInMemoryDragonBallPriceReferencesRepository(),
    imageSafetyRepository: createInMemoryImageSafetyRepository()
  });
}

describe("api app", () => {
  it("rejects production startup with default in-memory repositories", () => {
    expect(() => buildApp({ env: productionEnv })).toThrow(
      new Error("Production repositories must be explicitly configured; in-memory repositories are development only")
    );
  });

  it("returns health status", async () => {
    const app = buildApp();
    try {
      const response = await app.inject({ method: "GET", url: "/health" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true, service: "auction-api" });
    } finally {
      await app.close();
    }
  });

  it("uses warn-level request logging by default to avoid noisy access logs", async () => {
    const app = buildApp({ env: { NODE_ENV: "development" } });
    try {
      expect(app.log.level).toBe("warn");
    } finally {
      await app.close();
    }
  });

  it("allows request logging to be raised when troubleshooting", async () => {
    const app = buildApp({ env: { NODE_ENV: "development", LOG_LEVEL: "info" } });
    try {
      expect(app.log.level).toBe("info");
    } finally {
      await app.close();
    }
  });

  it("records structured request timing logs", async () => {
    const entries: Array<{ level: "info" | "warn"; payload: Record<string, unknown>; message: string }> = [];
    const hooks = createRequestTimingHooks({
      slowRequestThresholdMs: 800,
      now: (() => {
        const values = [1000, 1125];
        return () => values.shift() ?? 1125;
      })(),
      log: {
        info(payload, message) {
          entries.push({ level: "info", payload, message });
        },
        warn(payload, message) {
          entries.push({ level: "warn", payload, message });
        }
      }
    });

    hooks.onRequest({
      method: "GET",
      url: "/api/assets?page=1",
      id: "req-1"
    });
    hooks.onResponse(
      {
        method: "GET",
        url: "/api/assets?page=1",
        id: "req-1",
        routeOptions: { url: "/api/assets" }
      },
      { statusCode: 200 }
    );

    expect(entries).toEqual([
      {
        level: "info",
        message: "api_request_completed",
        payload: expect.objectContaining({
          method: "GET",
          route: "/api/assets",
          statusCode: 200,
          durationMs: 125,
          requestId: "req-1",
          slow: false
        })
      }
    ]);
  });

  it("records slow request timing logs at warn level", async () => {
    const entries: Array<{ level: "info" | "warn"; payload: Record<string, unknown>; message: string }> = [];
    const hooks = createRequestTimingHooks({
      slowRequestThresholdMs: 100,
      now: (() => {
        const values = [1000, 1255];
        return () => values.shift() ?? 1255;
      })(),
      log: {
        info(payload, message) {
          entries.push({ level: "info", payload, message });
        },
        warn(payload, message) {
          entries.push({ level: "warn", payload, message });
        }
      }
    });

    hooks.onRequest({ method: "POST", url: "/api/bids", id: "req-2" });
    hooks.onResponse(
      {
        method: "POST",
        url: "/api/bids",
        id: "req-2",
        routeOptions: { url: "/api/bids" }
      },
      { statusCode: 200 }
    );

    expect(entries).toEqual([
      {
        level: "warn",
        message: "api_request_slow",
        payload: expect.objectContaining({
          method: "POST",
          route: "/api/bids",
          statusCode: 200,
          durationMs: 255,
          requestId: "req-2",
          slow: true
        })
      }
    ]);
  });

  it("returns request errors with the original status code", async () => {
    const app = buildApp();
    app.get("/test/request-error", async () => {
      const error = new Error("Validation failed") as Error & { statusCode: number };
      error.statusCode = 422;
      throw error;
    });

    try {
      const response = await app.inject({ method: "GET", url: "/test/request-error" });
      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual({ error: { code: "request_error", message: "Validation failed" } });
    } finally {
      await app.close();
    }
  });

  it("returns generic internal errors for status code 503", async () => {
    const app = buildApp();
    app.get("/test/upstream-error", async () => {
      const error = new Error("Upstream password leaked") as Error & { statusCode: number };
      error.statusCode = 503;
      throw error;
    });

    try {
      const response = await app.inject({ method: "GET", url: "/test/upstream-error" });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: { code: "internal_error", message: "Internal server error" }
      });
    } finally {
      await app.close();
    }
  });

  it("returns HttpError details unchanged", async () => {
    const app = buildApp();
    app.get("/test/http-error", async () => {
      throw new HttpError(409, "asset_conflict", "Asset already changed", { field: "status" });
    });

    try {
      const response = await app.inject({ method: "GET", url: "/test/http-error" });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: { code: "asset_conflict", message: "Asset already changed", details: { field: "status" } }
      });
    } finally {
      await app.close();
    }
  });

  it("returns generic internal errors for 503 HttpError", async () => {
    const app = buildApp();
    app.get("/test/http-internal-error", async () => {
      throw new HttpError(503, "upstream_secret", "Upstream password leaked", { secret: "visible" });
    });

    try {
      const response = await app.inject({ method: "GET", url: "/test/http-internal-error" });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: { code: "internal_error", message: "Internal server error" }
      });
    } finally {
      await app.close();
    }
  });

  it("uses a production CORS allowlist instead of reflecting any origin", async () => {
    const app = buildProductionApp({
      ...productionEnv,
      CORS_ALLOWED_ORIGINS: "https://admin.example.com"
    });

    try {
      const allowed = await app.inject({
        method: "OPTIONS",
        url: "/health",
        headers: {
          origin: "https://admin.example.com",
          "access-control-request-method": "GET"
        }
      });
      const denied = await app.inject({
        method: "OPTIONS",
        url: "/health",
        headers: {
          origin: "https://evil.example.com",
          "access-control-request-method": "GET"
        }
      });

      expect(allowed.headers["access-control-allow-origin"]).toBe("https://admin.example.com");
      expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

describe("readEnv", () => {
  it("rejects invalid ports", () => {
    expect(() => readEnv({ PORT: "abc" })).toThrow(new Error("Invalid PORT"));
  });

  it("rejects out of range ports", () => {
    expect(() => readEnv({ PORT: "70000" })).toThrow(new Error("Invalid PORT"));
  });

  it("requires explicit JWT_SECRET in production", () => {
    expect(() => readEnv({ NODE_ENV: "production" })).toThrow(
      new Error("Missing required production environment variable: JWT_SECRET")
    );
  });

  it("rejects unsafe production JWT_SECRET", () => {
    expect(() => readEnv({ ...productionEnv, JWT_SECRET: "dev-secret-change-me" })).toThrow(
      new Error("Unsafe production environment variable: JWT_SECRET")
    );
  });

  it("rejects whitespace-padded unsafe production JWT_SECRET", () => {
    expect(() => readEnv({ ...productionEnv, JWT_SECRET: " dev-secret-change-me " })).toThrow(
      new Error("Unsafe production environment variable: JWT_SECRET")
    );
  });

  it("rejects unsafe production MYSQL_URI", () => {
    expect(() =>
      readEnv({ ...productionEnv, MYSQL_URI: "mysql://root:password@127.0.0.1:3306/auction_platform" })
    ).toThrow(new Error("Unsafe production environment variable: MYSQL_URI"));
  });

  it("rejects whitespace-padded unsafe production MYSQL_URI", () => {
    expect(() =>
      readEnv({ ...productionEnv, MYSQL_URI: " mysql://root:password@127.0.0.1:3306/auction_platform " })
    ).toThrow(new Error("Unsafe production environment variable: MYSQL_URI"));
  });

  it("treats whitespace-only production values as missing", () => {
    expect(() => readEnv({ ...productionEnv, R2_ENDPOINT: "   " })).toThrow(
      new Error("Missing required production environment variable: R2_ENDPOINT")
    );
  });

  it("rejects disabled content safety in production", () => {
    expect(() => readEnv({ ...productionEnv, CONTENT_SAFETY_ENABLED: "false" })).toThrow(
      new Error("CONTENT_SAFETY_ENABLED must be true in production")
    );
  });

  it("rejects non-strict content safety in production", () => {
    expect(() => readEnv({ ...productionEnv, CONTENT_SAFETY_STRICT: "false" })).toThrow(
      new Error("CONTENT_SAFETY_STRICT must be true in production")
    );
  });

  it("parses explicit CORS allowed origins", () => {
    expect(
      readEnv({ ...productionEnv, CORS_ALLOWED_ORIGINS: "https://admin.example.com, https://servicewechat.com" }).corsAllowedOrigins
    ).toEqual(["https://admin.example.com", "https://servicewechat.com"]);
  });

  it("uses bounded MySQL pool idle defaults to avoid long-lived sleep connections", () => {
    expect(readEnv(productionEnv)).toMatchObject({
      mysqlConnectionLimit: 10,
      mysqlMaxIdle: 2,
      mysqlIdleTimeoutMs: 60000
    });
  });

  it("uses a default slow request threshold for API timing logs", () => {
    expect(readEnv(productionEnv).apiSlowRequestThresholdMs).toBe(800);
  });

  it("parses API slow request threshold overrides", () => {
    expect(readEnv({ ...productionEnv, API_SLOW_REQUEST_THRESHOLD_MS: "1200" }).apiSlowRequestThresholdMs).toBe(1200);
  });

  it("rejects invalid API slow request thresholds", () => {
    expect(() => readEnv({ ...productionEnv, API_SLOW_REQUEST_THRESHOLD_MS: "0" })).toThrow(
      new Error("Invalid API_SLOW_REQUEST_THRESHOLD_MS")
    );
  });

  it("parses MySQL pool sizing overrides", () => {
    expect(
      readEnv({
        ...productionEnv,
        MYSQL_CONNECTION_LIMIT: "8",
        MYSQL_MAX_IDLE: "1",
        MYSQL_IDLE_TIMEOUT_MS: "30000"
      })
    ).toMatchObject({
      mysqlConnectionLimit: 8,
      mysqlMaxIdle: 1,
      mysqlIdleTimeoutMs: 30000
    });
  });

  it("rejects invalid MySQL pool sizing", () => {
    expect(() => readEnv({ ...productionEnv, MYSQL_CONNECTION_LIMIT: "0" })).toThrow(
      new Error("Invalid MYSQL_CONNECTION_LIMIT")
    );
    expect(() => readEnv({ ...productionEnv, MYSQL_CONNECTION_LIMIT: "2", MYSQL_MAX_IDLE: "3" })).toThrow(
      new Error("Invalid MYSQL_MAX_IDLE")
    );
    expect(() => readEnv({ ...productionEnv, MYSQL_IDLE_TIMEOUT_MS: "0" })).toThrow(
      new Error("Invalid MYSQL_IDLE_TIMEOUT_MS")
    );
  });
});
