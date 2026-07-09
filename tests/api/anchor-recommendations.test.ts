import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";

async function adminToken(app: ReturnType<typeof buildApp>, username = "operator", password = "operator-pass") {
  const response = await app.inject({
    method: "POST",
    url: "/admin/auth/login",
    payload: { username, password }
  });
  return response.json().token as string;
}

describe("anchor recommendations", () => {
  it("publishes admin-maintained anchors to the public list", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const initialPublic = await app.inject({ method: "GET", url: "/api/anchor-recommendations" });
      expect(initialPublic.statusCode).toBe(200);
      expect(initialPublic.json()).toEqual({ items: [] });

      const token = await adminToken(app);
      const created = await app.inject({
        method: "POST",
        url: "/admin/anchor-recommendations",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "阿塔",
          intro: "专注塔防精灵龙珠交换和阵容讲解",
          imageUrl: "https://example.com/anchors/ata.png"
        }
      });

      expect(created.statusCode).toBe(200);
      expect(created.json().anchor).toMatchObject({
        id: "1",
        name: "阿塔",
        intro: "专注塔防精灵龙珠交换和阵容讲解",
        imageUrl: "https://example.com/anchors/ata.png"
      });

      const publicList = await app.inject({ method: "GET", url: "/api/anchor-recommendations" });
      const adminList = await app.inject({
        method: "GET",
        url: "/admin/anchor-recommendations",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(publicList.statusCode).toBe(200);
      expect(adminList.statusCode).toBe(200);
      expect(publicList.json()).toEqual({ items: [created.json().anchor] });
      expect(adminList.json()).toEqual({ items: [created.json().anchor] });
    } finally {
      await app.close();
    }
  });

  it("updates and deletes anchors from public recommendations", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await adminToken(app);
      const created = await app.inject({
        method: "POST",
        url: "/admin/anchor-recommendations",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "阿塔",
          intro: "旧简介",
          imageUrl: "https://example.com/anchors/old.png"
        }
      });
      expect(created.statusCode).toBe(200);

      const updated = await app.inject({
        method: "PUT",
        url: "/admin/anchor-recommendations/1",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "阿塔直播间",
          intro: "每晚分享交换行情",
          imageUrl: "https://example.com/anchors/new.png"
        }
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().anchor).toMatchObject({
        id: "1",
        name: "阿塔直播间",
        intro: "每晚分享交换行情",
        imageUrl: "https://example.com/anchors/new.png"
      });

      const afterUpdate = await app.inject({ method: "GET", url: "/api/anchor-recommendations" });
      expect(afterUpdate.json()).toEqual({ items: [updated.json().anchor] });

      const deleted = await app.inject({
        method: "DELETE",
        url: "/admin/anchor-recommendations/1",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(deleted.statusCode).toBe(200);
      expect(deleted.json()).toEqual({ ok: true });

      const afterDelete = await app.inject({ method: "GET", url: "/api/anchor-recommendations" });
      expect(afterDelete.json()).toEqual({ items: [] });
    } finally {
      await app.close();
    }
  });

  it("requires an admin token for management routes", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const read = await app.inject({ method: "GET", url: "/admin/anchor-recommendations" });
      const create = await app.inject({
        method: "POST",
        url: "/admin/anchor-recommendations",
        payload: { name: "阿塔", intro: "简介", imageUrl: "https://example.com/a.png" }
      });
      const update = await app.inject({
        method: "PUT",
        url: "/admin/anchor-recommendations/1",
        payload: { name: "阿塔", intro: "简介", imageUrl: "https://example.com/a.png" }
      });
      const remove = await app.inject({ method: "DELETE", url: "/admin/anchor-recommendations/1" });

      expect(read.statusCode).toBe(401);
      expect(create.statusCode).toBe(401);
      expect(update.statusCode).toBe(401);
      expect(remove.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
