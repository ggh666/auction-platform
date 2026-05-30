import { describe, expect, it } from "vitest";
import { buildRuntimeApp } from "../../api/src/runtimeApp";

const productionEnv = {
  NODE_ENV: "production",
  JWT_SECRET: "production-secret",
  MYSQL_URI: "mysql://auction:secret@127.0.0.1:3306/auction_platform",
  R2_ENDPOINT: "https://r2.example.com",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET: "auction-assets-prod",
  WECHAT_APPID: "wx-test-appid",
  WECHAT_APP_SECRET: "wx-test-secret",
  WECHAT_EVENT_TOKEN: "event-token"
};

describe("runtime app", () => {
  it("injects MySQL-backed repositories for production startup", async () => {
    let closed = false;
    const { app, env } = buildRuntimeApp({
      env: productionEnv,
      pool: {
        async execute() {
          return [[], []];
        },
        async getConnection() {
          throw new Error("not used by health check");
        },
        async end() {
          closed = true;
        }
      }
    });

    try {
      expect(env.nodeEnv).toBe("production");
      const response = await app.inject({ method: "GET", url: "/health" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true, service: "auction-api" });
    } finally {
      await app.close();
    }

    expect(closed).toBe(true);
  });
});
