import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import { createInMemoryAssetsRepository, type AssetsRepository } from "../../api/src/modules/assets/assets.repository";
import { createInMemoryUsersRepository } from "../../api/src/modules/users/users.repository";

const futureEndAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

async function login(app: ReturnType<typeof buildApp>, displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/mock-login",
    payload: { displayName }
  });
  return response.json() as { token: string; user: { id: string } };
}

async function adminLogin(app: ReturnType<typeof buildApp>, username = "reviewer", password = "reviewer-pass") {
  const response = await app.inject({
    method: "POST",
    url: "/admin/auth/login",
    payload: { username, password }
  });
  return response.json().token as string;
}

function assetPayload(overrides: Record<string, unknown> = {}) {
  return {
    gameName: "梦幻西游",
    serverName: "测试区",
    assetType: "角色",
    principalId: "1",
    title: "待成交资产",
    description: "成交跟进测试资产",
    startingPriceCents: 10000,
    minIncrementCents: 100,
    originalEndAt: futureEndAt(),
    ...overrides
  };
}

async function createEndedSoldAsset(
  app: ReturnType<typeof buildApp>,
  assets: AssetsRepository,
  sellerToken: string,
  bidderToken: string,
  overrides: Record<string, unknown> = {}
) {
  const created = await app.inject({
    method: "POST",
    url: "/api/assets",
    headers: { authorization: `Bearer ${sellerToken}` },
    payload: assetPayload(overrides)
  });
  const assetId = created.json().asset.id as string;
  const reviewer = await adminLogin(app);
  await app.inject({
    method: "POST",
    url: `/admin/assets/${assetId}/approve`,
    headers: { authorization: `Bearer ${reviewer}` }
  });
  await app.inject({
    method: "POST",
    url: "/api/bids",
    headers: { authorization: `Bearer ${bidderToken}` },
    payload: { assetId, amountCents: 10000, commitmentAccepted: true }
  });
  await assets.updateStatus(assetId, "ended");
  return assetId;
}

describe("deal followups", () => {
  it("lets the winning buyer confirm or abandon an ended sold asset without phone authorization", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const seller = await login(app, "卖家");
      const buyer = await login(app, "买家");
      const assetId = await createEndedSoldAsset(app, assets, seller.token, buyer.token, { title: "买家待确认资产" });

      const list = await app.inject({
        method: "GET",
        url: "/api/profile/deal-followups",
        headers: { authorization: `Bearer ${buyer.token}` }
      });
      const followupId = list.json().items[0].id as string;

      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject({
        total: 1,
        items: [
          expect.objectContaining({
            assetId,
            buyerId: buyer.user.id,
            sellerId: seller.user.id,
            finalPriceCents: 10000,
            status: "pending_buyer_confirm",
            asset: expect.objectContaining({ title: "买家待确认资产" })
          })
        ]
      });

      const confirmed = await app.inject({
        method: "POST",
        url: `/api/profile/deal-followups/${followupId}/confirm`,
        headers: { authorization: `Bearer ${buyer.token}` }
      });
      const abandoned = await app.inject({
        method: "POST",
        url: `/api/profile/deal-followups/${followupId}/abandon`,
        headers: { authorization: `Bearer ${buyer.token}` }
      });

      expect(confirmed.statusCode).toBe(200);
      expect(confirmed.json().followup).toMatchObject({
        id: followupId,
        status: "buyer_confirmed",
        buyerConfirmedAt: expect.any(String)
      });
      expect(abandoned.statusCode).toBe(200);
      expect(abandoned.json().followup).toMatchObject({
        id: followupId,
        status: "buyer_abandoned",
        buyerAbandonedAt: expect.any(String)
      });
    } finally {
      await app.close();
    }
  });

  it("scopes admin followup lists to the current principal and lets principals record contact status", async () => {
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, assetsRepository: assets });

    try {
      const seller = await login(app, "卖家");
      const buyer = await login(app, "买家");
      const ownAssetId = await createEndedSoldAsset(app, assets, seller.token, buyer.token, { principalId: "1", title: "本主理人成交" });
      await createEndedSoldAsset(app, assets, seller.token, buyer.token, { principalId: "2", title: "其他主理人成交" });
      const reviewer = await adminLogin(app);

      const list = await app.inject({
        method: "GET",
        url: "/admin/deal-followups",
        headers: { authorization: `Bearer ${reviewer}` }
      });
      const followupId = list.json().items[0].id as string;
      const contacted = await app.inject({
        method: "POST",
        url: `/admin/deal-followups/${followupId}/status`,
        headers: { authorization: `Bearer ${reviewer}` },
        payload: { status: "principal_contacted", note: "已通过站内状态确认联系" }
      });

      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject({
        total: 1,
        items: [expect.objectContaining({ assetId: ownAssetId, principalId: "1", status: "pending_buyer_confirm" })]
      });
      expect(contacted.statusCode).toBe(200);
      expect(contacted.json().followup).toMatchObject({
        id: followupId,
        status: "principal_contacted",
        note: "已通过站内状态确认联系",
        principalContactedAt: expect.any(String)
      });
    } finally {
      await app.close();
    }
  });

  it("records repeated unreachable buyers and blocks later bids without collecting phone numbers", async () => {
    const users = createInMemoryUsersRepository();
    const assets = createInMemoryAssetsRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users, assetsRepository: assets });

    try {
      const seller = await login(app, "卖家");
      const buyer = await login(app, "买家");
      await createEndedSoldAsset(app, assets, seller.token, buyer.token, { title: "第一次失联资产" });
      await createEndedSoldAsset(app, assets, seller.token, buyer.token, { title: "第二次失联资产" });
      const reviewer = await adminLogin(app);
      const list = await app.inject({
        method: "GET",
        url: "/admin/deal-followups",
        headers: { authorization: `Bearer ${reviewer}` }
      });

      for (const item of list.json().items as Array<{ id: string }>) {
        const marked = await app.inject({
          method: "POST",
          url: `/admin/deal-followups/${item.id}/status`,
          headers: { authorization: `Bearer ${reviewer}` },
          payload: { status: "buyer_unreachable", note: "买家未在小程序内确认成交" }
        });
        expect(marked.statusCode).toBe(200);
      }

      const buyerRecord = await users.findById(Number(buyer.user.id));
      const nextAsset = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${seller.token}` },
        payload: assetPayload({ title: "后续限制出价资产" })
      });
      const nextAssetId = nextAsset.json().asset.id as string;
      await app.inject({
        method: "POST",
        url: `/admin/assets/${nextAssetId}/approve`,
        headers: { authorization: `Bearer ${reviewer}` }
      });
      const blocked = await app.inject({
        method: "POST",
        url: "/api/bids",
        headers: { authorization: `Bearer ${buyer.token}` },
        payload: { assetId: nextAssetId, amountCents: 10000, commitmentAccepted: true }
      });

      expect(buyerRecord).toMatchObject({
        buyer_unreachable_count: 2,
        bid_restricted_until: expect.any(Date)
      });
      expect(blocked.statusCode).toBe(403);
      expect(blocked.json().error).toMatchObject({
        code: "bid_restricted",
        message: "User is temporarily restricted from bidding",
        details: {
          buyerUnreachableCount: 2,
          bidRestrictedUntil: expect.any(String)
        }
      });
    } finally {
      await app.close();
    }
  });
});
