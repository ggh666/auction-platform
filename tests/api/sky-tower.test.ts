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

describe("sky tower settings", () => {
  it("publishes admin-maintained sky tower floors as a public merged list", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const initialPublic = await app.inject({ method: "GET", url: "/api/sky-tower" });
      expect(initialPublic.statusCode).toBe(200);
      const initialConfig = initialPublic.json();
      expect(initialConfig.floors).toHaveLength(40);
      expect(initialConfig.floors[0]).toMatchObject({
        floor: 1,
        formationSummary: "资料待补充",
        rewardAmount: 4
      });
      expect(initialConfig.rewards).toEqual(
        expect.arrayContaining([{ range: "10层", desc: "精英关卡", amount: 10, highlight: true }])
      );

      const token = await adminToken(app, "operator", "operator-pass");
      const rawText = "1|前车猴子后车咕咕|猴子、酋长|咕咕、萨满|前车1:猴子:orange;后车1:咕咕:yellow|先开猴子；注意沉默";
      const saved = await app.inject({
        method: "PUT",
        url: "/admin/sky-tower/config",
        headers: { authorization: `Bearer ${token}` },
        payload: { rawText }
      });
      expect(saved.statusCode).toBe(200);
      const savedConfig = saved.json();
      expect(savedConfig).toMatchObject({
        rawText,
        updatedBy: 2
      });
      expect(savedConfig.floors[0]).toMatchObject({
        floor: 1,
        formationSummary: "前车猴子后车咕咕",
        frontChariot: ["猴子", "酋长"],
        backChariot: ["咕咕", "萨满"],
        heroSlots: [
          { position: "前车1", name: "猴子", quality: "orange" },
          { position: "后车1", name: "咕咕", quality: "yellow" }
        ],
        tactics: ["先开猴子", "注意沉默"]
      });

      const publicConfig = await app.inject({ method: "GET", url: "/api/sky-tower" });
      expect(publicConfig.statusCode).toBe(200);
      expect(publicConfig.json().floors[0]).toMatchObject(savedConfig.floors[0]);
      expect(publicConfig.json().floors[1]).toMatchObject({ floor: 2, formationSummary: "资料待补充" });
    } finally {
      await app.close();
    }
  });

  it("rejects invalid admin text without replacing the previous public config", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminToken(app);
      const validRawText = "1|有效阵容|前车|后车|前车:英雄:green|备注";
      const saved = await app.inject({
        method: "PUT",
        url: "/admin/sky-tower/config",
        headers: { authorization: `Bearer ${token}` },
        payload: { rawText: validRawText }
      });
      expect(saved.statusCode).toBe(200);

      const invalid = await app.inject({
        method: "PUT",
        url: "/admin/sky-tower/config",
        headers: { authorization: `Bearer ${token}` },
        payload: { rawText: "41|阵容|前车|后车|前车:英雄:green|备注" }
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error).toMatchObject({
        code: "invalid_sky_tower_settings",
        message: expect.stringContaining("第 1 行")
      });

      const publicConfig = await app.inject({ method: "GET", url: "/api/sky-tower" });
      expect(publicConfig.json().floors[0]).toMatchObject({
        floor: 1,
        formationSummary: "有效阵容"
      });
    } finally {
      await app.close();
    }
  });

  it("accepts admin text copied with the header row", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminToken(app, "operator", "operator-pass");
      const rawText = [
        "楼层|阵容说明|左侧战车|右侧战车|英雄位|战术备注",
        "1|前车猴子后车咕咕，控制节奏|猴子|咕咕|左1:猴子:orange|先开猴子"
      ].join("\n");
      const saved = await app.inject({
        method: "PUT",
        url: "/admin/sky-tower/config",
        headers: { authorization: `Bearer ${token}` },
        payload: { rawText }
      });

      expect(saved.statusCode).toBe(200);
      expect(saved.json().rawText).toBe(rawText);
      expect(saved.json().floors[0]).toMatchObject({
        floor: 1,
        formationSummary: "前车猴子后车咕咕，控制节奏"
      });
    } finally {
      await app.close();
    }
  });

  it("requires an admin token for settings reads and writes", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const read = await app.inject({ method: "GET", url: "/admin/sky-tower/config" });
      const write = await app.inject({
        method: "PUT",
        url: "/admin/sky-tower/config",
        payload: { rawText: "1|阵容|前车|后车|前车:英雄:green|备注" }
      });

      expect(read.statusCode).toBe(401);
      expect(write.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
