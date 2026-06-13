import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";

const projectRoot = resolve(import.meta.dirname, "../..");

async function adminToken(app: ReturnType<typeof buildApp>) {
  const response = await app.inject({
    method: "POST",
    url: "/admin/auth/login",
    payload: { username: "super", password: "super-pass" }
  });
  return response.json().token as string;
}

function batchPayload(overrides: Record<string, unknown> = {}) {
  return {
    gameName: "塔防精灵",
    weekStartDate: "2026-06-01",
    note: "6月第1周成交区间",
    items: [
      { profession: "牧师", quality: "红", minPriceCents: 152000, maxPriceCents: 640000 },
      { profession: "战士", quality: "金", minPriceCents: 52000, maxPriceCents: 135000 },
      { profession: "工程", quality: "紫", minPriceCents: 13500, maxPriceCents: 40000 }
    ],
    ...overrides
  };
}

describe("dragon ball price references", () => {
  it("keeps the image-derived initial reference rows in the seed migration", () => {
    const seedSql = readFileSync(
      resolve(projectRoot, "api/src/db/migrations/023_seed_dragon_ball_price_references.sql"),
      "utf8"
    );

    expect(seedSql).toContain("6月1日-6日龙珠品类成交价区间统计");
    expect(seedSql.match(/\(@dragon_ball_price_reference_batch_id,/g)).toHaveLength(30);
    expect(seedSql).toContain("红色牧师");
    expect(seedSql).toContain("'牧师', '红', 152000, 640000");
    expect(seedSql).not.toContain("战将");
    expect(seedSql).toContain("绿色猎人");
    expect(seedSql).toContain("'猎人', '绿', 1000, 1000");
  });

  it("lets admins create weekly references and exposes latest and trend data", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminToken(app);
      const created = await app.inject({
        method: "POST",
        url: "/admin/dragon-ball-price-reference-batches",
        headers: { authorization: `Bearer ${token}` },
        payload: batchPayload()
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().batch).toMatchObject({
        gameName: "塔防精灵",
        weekStartDate: "2026-06-01",
        weekEndDate: "2026-06-07",
        note: "6月第1周成交区间",
        items: expect.arrayContaining([
          expect.objectContaining({
            profession: "牧师",
            quality: "红",
            minPriceCents: 152000,
            maxPriceCents: 640000
          }),
          expect.objectContaining({
            profession: "战士",
            quality: "金",
            minPriceCents: 52000,
            maxPriceCents: 135000
          })
        ])
      });

      const updated = await app.inject({
        method: "POST",
        url: "/admin/dragon-ball-price-reference-batches",
        headers: { authorization: `Bearer ${token}` },
        payload: batchPayload({
          note: "覆盖同周数据",
          items: [
            { profession: "牧师", quality: "红", minPriceCents: 160000, maxPriceCents: 650000 },
            { profession: "战士", quality: "金", minPriceCents: 52000, maxPriceCents: 135000 }
          ]
        })
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().batch.id).toBe(created.json().batch.id);
      expect(updated.json().batch.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ profession: "牧师", quality: "红", minPriceCents: 160000, maxPriceCents: 650000 }),
          expect.objectContaining({ profession: "战士", quality: "金", minPriceCents: 52000, maxPriceCents: 135000 })
        ])
      );

      const latest = await app.inject({
        method: "GET",
        url: "/api/dragon-ball-price-references/latest?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5"
      });
      const trend = await app.inject({
        method: "GET",
        url: "/api/dragon-ball-price-references/trend?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&profession=%E7%89%A7%E5%B8%88&quality=%E7%BA%A2"
      });

      expect(latest.statusCode).toBe(200);
      expect(latest.json().batch).toMatchObject({
        id: created.json().batch.id,
        items: expect.arrayContaining([
          expect.objectContaining({ profession: "牧师", quality: "红", minPriceCents: 160000, maxPriceCents: 650000 })
        ])
      });
      expect(trend.statusCode).toBe(200);
      expect(trend.json()).toMatchObject({
        items: [
          expect.objectContaining({
            weekStartDate: "2026-06-01",
            weekEndDate: "2026-06-07",
            profession: "牧师",
            quality: "红",
            minPriceCents: 160000,
            maxPriceCents: 650000
          })
        ]
      });

      const warlordTrend = await app.inject({
        method: "GET",
        url: "/api/dragon-ball-price-references/trend?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&profession=%E6%88%98%E5%B0%86&quality=%E9%87%91"
      });
      expect(warlordTrend.statusCode).toBe(400);
      expect(warlordTrend.json().error.code).toBe("invalid_price_reference_item");
    } finally {
      await app.close();
    }
  });

  it("rejects invalid weekly reference rows", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminToken(app);
      const invalidProfession = await app.inject({
        method: "POST",
        url: "/admin/dragon-ball-price-reference-batches",
        headers: { authorization: `Bearer ${token}` },
        payload: batchPayload({ items: [{ profession: "战将", quality: "红", minPriceCents: 10000, maxPriceCents: 20000 }] })
      });
      const nonWholeYuan = await app.inject({
        method: "POST",
        url: "/admin/dragon-ball-price-reference-batches",
        headers: { authorization: `Bearer ${token}` },
        payload: batchPayload({ items: [{ profession: "牧师", quality: "红", minPriceCents: 10001, maxPriceCents: 20000 }] })
      });
      const invertedRange = await app.inject({
        method: "POST",
        url: "/admin/dragon-ball-price-reference-batches",
        headers: { authorization: `Bearer ${token}` },
        payload: batchPayload({ items: [{ profession: "牧师", quality: "红", minPriceCents: 30000, maxPriceCents: 20000 }] })
      });

      expect(invalidProfession.statusCode).toBe(400);
      expect(invalidProfession.json().error.code).toBe("invalid_price_reference_item");
      expect(nonWholeYuan.statusCode).toBe(400);
      expect(nonWholeYuan.json().error.code).toBe("invalid_price_reference_price");
      expect(invertedRange.statusCode).toBe(400);
      expect(invertedRange.json().error.code).toBe("invalid_price_reference_range");
    } finally {
      await app.close();
    }
  });
});
