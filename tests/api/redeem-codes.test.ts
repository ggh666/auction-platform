import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";

async function adminToken(app: ReturnType<typeof buildApp>, username = "reviewer", password = "reviewer-pass") {
  const response = await app.inject({
    method: "POST",
    url: "/admin/auth/login",
    payload: { username, password }
  });
  return response.json().token as string;
}

describe("redeem codes", () => {
  it("publishes the saved redeem code text as a public parsed list", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const emptyPublicList = await app.inject({ method: "GET", url: "/api/redeem-codes" });
      expect(emptyPublicList.statusCode).toBe(200);
      expect(emptyPublicList.json()).toEqual({ items: [] });

      const token = await adminToken(app);
      const rawText = "TFJL520|随机金卡|永久\nTFGLQD0901|随机金卡*1+钻石*300+金币*3888|2024-11-30";
      const saved = await app.inject({
        method: "PUT",
        url: "/admin/redeem-codes/config",
        headers: { authorization: `Bearer ${token}` },
        payload: { rawText }
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toMatchObject({
        rawText,
        items: [
          { code: "TFJL520", description: "随机金卡", validity: "永久" },
          { code: "TFGLQD0901", description: "随机金卡*1+钻石*300+金币*3888", validity: "2024-11-30" }
        ]
      });

      const adminConfig = await app.inject({
        method: "GET",
        url: "/admin/redeem-codes/config",
        headers: { authorization: `Bearer ${token}` }
      });
      const publicList = await app.inject({ method: "GET", url: "/api/redeem-codes" });

      expect(adminConfig.statusCode).toBe(200);
      expect(adminConfig.json()).toMatchObject({ rawText, updatedBy: 1 });
      expect(publicList.statusCode).toBe(200);
      expect(publicList.json()).toEqual({ items: saved.json().items });
    } finally {
      await app.close();
    }
  });

  it("rejects invalid admin text without replacing the previous public list", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminToken(app, "operator", "operator-pass");
      const validRawText = "TFJL520|随机金卡|永久";
      const saved = await app.inject({
        method: "PUT",
        url: "/admin/redeem-codes/config",
        headers: { authorization: `Bearer ${token}` },
        payload: { rawText: validRawText }
      });
      expect(saved.statusCode).toBe(200);

      const invalid = await app.inject({
        method: "PUT",
        url: "/admin/redeem-codes/config",
        headers: { authorization: `Bearer ${token}` },
        payload: { rawText: "TFJL520|随机金卡" }
      });
      const publicList = await app.inject({ method: "GET", url: "/api/redeem-codes" });

      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error).toMatchObject({
        code: "invalid_redeem_code_settings",
        message: expect.stringContaining("第 1 行")
      });
      expect(publicList.json()).toEqual({
        items: [{ code: "TFJL520", description: "随机金卡", validity: "永久" }]
      });
    } finally {
      await app.close();
    }
  });

  it("requires an admin token for settings reads and writes", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const read = await app.inject({ method: "GET", url: "/admin/redeem-codes/config" });
      const write = await app.inject({
        method: "PUT",
        url: "/admin/redeem-codes/config",
        payload: { rawText: "TFJL520|随机金卡|永久" }
      });

      expect(read.statusCode).toBe(401);
      expect(write.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
