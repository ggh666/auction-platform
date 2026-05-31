import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/src/app";
import { HttpError } from "../../api/src/http/errors";
import { createReportsService } from "../../api/src/modules/reports/reports.service";
import { createInMemoryUsersRepository } from "../../api/src/modules/users/users.repository";

const futureEndAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

async function userToken(app: ReturnType<typeof buildApp>, displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/mock-login",
    payload: { displayName }
  });
  return response.json().token as string;
}

async function createReportableAuction(app: ReturnType<typeof buildApp>) {
  const sellerToken = await userToken(app, "卖家");
  const bidderToken = await userToken(app, "出价人");
  const reviewer = await adminToken(app);
  const created = await app.inject({
    method: "POST",
    url: "/api/assets",
    headers: { authorization: `Bearer ${sellerToken}` },
    payload: {
      gameName: "塔防精灵",
      serverName: "测试区",
      assetType: "账号",
      principalId: "1",
      title: "可举报资产",
      description: "测试举报权限",
      startingPriceCents: 10000,
      minIncrementCents: 100,
      originalEndAt: futureEndAt()
    }
  });
  const assetId = created.json().asset.id as string;
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

  return {
    assetId,
    sellerId: "1",
    bidderId: "2",
    sellerToken,
    bidderToken,
    reviewer
  };
}

async function adminToken(app: ReturnType<typeof buildApp>, username = "reviewer", password = "reviewer-pass") {
  const response = await app.inject({
    method: "POST",
    url: "/admin/auth/login",
    payload: { username, password }
  });
  return response.json().token as string;
}

describe("reports service", () => {
  it("creates reports as pending and private", async () => {
    const service = createReportsService();

    const report = await service.createReport({
      reporterUserId: "reporter-1",
      targetUserId: "target-1",
      assetId: "asset-1",
      reason: "虚假描述",
      evidence: "聊天记录"
    });

    expect(report).toMatchObject({
      reporterUserId: "reporter-1",
      targetUserId: "target-1",
      reason: "虚假描述",
      evidence: "聊天记录",
      status: "pending"
    });
    expect(await service.listPublicViolations()).toEqual([]);
  });

  it("confirms a pending report before publishing a public violation", async () => {
    const service = createReportsService();
    const report = await service.createReport({
      reporterUserId: "reporter-1",
      targetUserId: "target-1",
      assetId: "asset-1",
      reason: "恶意竞价",
      evidence: "出价记录"
    });

    const confirmed = await service.confirmReport(report.id, 1);
    const violation = await service.publishViolation(confirmed.id, 1);

    expect(confirmed.status).toBe("confirmed");
    expect(violation).toMatchObject({
      reportId: report.id,
      targetUserId: "target-1",
      reason: "恶意竞价",
      evidence: "出价记录",
      publishedByAdminId: 1
    });
    expect(await service.listPublicViolations()).toEqual([violation]);
  });

  it("rejects publishing violations for unconfirmed reports", async () => {
    const service = createReportsService();
    const report = await service.createReport({
      reporterUserId: "reporter-1",
      targetUserId: "target-1",
      assetId: "asset-1",
      reason: "辱骂",
      evidence: "截图"
    });

    await expect(service.publishViolation(report.id, 1)).rejects.toMatchObject({
      statusCode: 400,
      code: "report_not_confirmed"
    });
    expect(await service.listPublicViolations()).toEqual([]);
  });
});

describe("report routes", () => {
  it("requires login to create reports", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/reports",
        payload: { targetUserId: "2", reason: "虚假描述", evidence: "截图" }
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("rejects report creation when the reporter credit score is 70 or below", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users });

    try {
      const auction = await createReportableAuction(app);
      await users.deductCreditScore(Number(auction.bidderId), 30);

      const response = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${auction.bidderToken}` },
        payload: {
          targetUserId: auction.sellerId,
          assetId: auction.assetId,
          reason: "虚假描述",
          evidence: "聊天记录截图"
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

  it("rejects report creation from banned users even with an existing token", async () => {
    const users = createInMemoryUsersRepository();
    const app = buildApp({ enableMockAuth: true, usersRepository: users });

    try {
      const token = await userToken(app, "举报人");
      await users.banUser(1, "线下交易违约");

      const response = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${token}` },
        payload: { targetUserId: "2", reason: "虚假描述", evidence: "截图" }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("user_banned");
    } finally {
      await app.close();
    }
  });

  it("rejects invalid report payloads without a 500", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const token = await userToken(app, "举报人");
      const response = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${token}` },
        payload: { targetUserId: "   ", reason: 42, evidence: [] }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_report");
    } finally {
      await app.close();
    }
  });

  it("trims valid report payloads and keeps them pending", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const auction = await createReportableAuction(app);
      const response = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${auction.bidderToken}` },
        payload: {
          targetUserId: ` ${auction.sellerId} `,
          assetId: ` ${auction.assetId} `,
          reason: " 虚假描述 ",
          evidence: " 截图链接 "
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().report).toMatchObject({
        reporterUserId: auction.bidderId,
        targetUserId: auction.sellerId,
        assetId: auction.assetId,
        reason: "虚假描述",
        evidence: "截图链接",
        status: "pending"
      });
    } finally {
      await app.close();
    }
  });

  it("rejects report creation when the reporter did not bid on the asset", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const auction = await createReportableAuction(app);
      const outsiderToken = await userToken(app, "围观用户");
      const response = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${outsiderToken}` },
        payload: {
          targetUserId: auction.sellerId,
          assetId: auction.assetId,
          reason: "虚假描述",
          evidence: "截图"
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("report_not_allowed");
    } finally {
      await app.close();
    }
  });

  it("rejects report creation from the asset seller", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const auction = await createReportableAuction(app);
      const response = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${auction.sellerToken}` },
        payload: {
          targetUserId: auction.bidderId,
          assetId: auction.assetId,
          reason: "恶意竞价",
          evidence: "截图"
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("self_report_not_allowed");
    } finally {
      await app.close();
    }
  });

  it("blocks report creation when text content safety rejects reason or evidence", async () => {
    const app = buildApp({
      enableMockAuth: true,
      contentSafetyService: {
        async assertTextAllowed(input: { content: string }) {
          if (input.content.includes("违规广告")) {
            throw new HttpError(400, "content_safety_risky", "Content failed safety check");
          }
        },
        async requestImageCheck() {
          return { status: "pass" };
        },
        async assertImageUploadsAllowed() {},
        async assertAssetImagesAllowed() {}
      }
    });

    try {
      const auction = await createReportableAuction(app);
      const response = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${auction.bidderToken}` },
        payload: {
          targetUserId: auction.sellerId,
          assetId: auction.assetId,
          reason: "违规广告",
          evidence: "截图链接"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("content_safety_risky");
    } finally {
      await app.close();
    }
  });

  it("allows admin confirmation and only then publishes public violations", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const auction = await createReportableAuction(app);
      const reviewer = await adminToken(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${auction.bidderToken}` },
        payload: { targetUserId: auction.sellerId, assetId: auction.assetId, reason: "恶意竞价", evidence: "出价记录" }
      });
      const reportId = created.json().report.id as string;

      const earlyPublish = await app.inject({
        method: "POST",
        url: `/admin/reports/${reportId}/publish-violation`,
        headers: { authorization: `Bearer ${reviewer}` }
      });
      expect(earlyPublish.statusCode).toBe(400);
      expect(earlyPublish.json().error.code).toBe("report_not_confirmed");

      const confirm = await app.inject({
        method: "POST",
        url: `/admin/reports/${reportId}/confirm`,
        headers: { authorization: `Bearer ${reviewer}` }
      });
      expect(confirm.statusCode).toBe(200);
      expect(confirm.json().report.status).toBe("confirmed");

      const publish = await app.inject({
        method: "POST",
        url: `/admin/reports/${reportId}/publish-violation`,
        headers: { authorization: `Bearer ${reviewer}` }
      });
      expect(publish.statusCode).toBe(200);

      const publicViolations = await app.inject({ method: "GET", url: "/api/violations" });
      expect(publicViolations.statusCode).toBe(200);
      expect(publicViolations.json().items).toMatchObject([
        { reportId, targetUserId: auction.sellerId, reason: "恶意竞价" }
      ]);

      const detail = await app.inject({ method: "GET", url: `/api/assets/${auction.assetId}` });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().asset).toMatchObject({
        id: auction.assetId,
        hasPublishedViolation: true,
        sellerViolationCount: 0
      });

      const list = await app.inject({
        method: "GET",
        url: "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7"
      });
      expect(list.statusCode).toBe(200);
      expect(list.json().items).toEqual([
        expect.objectContaining({
          id: auction.assetId,
          hasPublishedViolation: true,
          sellerViolationCount: 0
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("marks only the reported asset as publicly violated, not every asset from the same seller", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const auction = await createReportableAuction(app);
      const createdOtherAsset = await app.inject({
        method: "POST",
        url: "/api/assets",
        headers: { authorization: `Bearer ${auction.sellerToken}` },
        payload: {
          gameName: "塔防精灵",
          serverName: "测试区",
          assetType: "账号",
          principalId: "1",
          title: "同卖家正常资产",
          description: "这个资产没有违规公示",
          startingPriceCents: 12000,
          minIncrementCents: 100,
          originalEndAt: futureEndAt()
        }
      });
      const otherAssetId = createdOtherAsset.json().asset.id as string;
      await app.inject({
        method: "POST",
        url: `/admin/assets/${otherAssetId}/approve`,
        headers: { authorization: `Bearer ${auction.reviewer}` }
      });
      const createdReport = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${auction.bidderToken}` },
        payload: { targetUserId: auction.sellerId, assetId: auction.assetId, reason: "恶意竞价", evidence: "出价记录" }
      });
      const reportId = createdReport.json().report.id as string;
      await app.inject({
        method: "POST",
        url: `/admin/reports/${reportId}/confirm`,
        headers: { authorization: `Bearer ${auction.reviewer}` }
      });
      await app.inject({
        method: "POST",
        url: `/admin/reports/${reportId}/publish-violation`,
        headers: { authorization: `Bearer ${auction.reviewer}` }
      });

      const list = await app.inject({
        method: "GET",
        url: "/api/assets?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E8%B4%A6%E5%8F%B7"
      });

      expect(list.statusCode).toBe(200);
      const items = list.json().items as Array<{ id: string; hasPublishedViolation?: boolean; sellerViolationCount?: number }>;
      expect(items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: auction.assetId, hasPublishedViolation: true, sellerViolationCount: 0 }),
          expect.objectContaining({ id: otherAssetId, hasPublishedViolation: false, sellerViolationCount: 0 })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("allows admins to reject pending reports", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const auction = await createReportableAuction(app);
      const reviewer = await adminToken(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${auction.bidderToken}` },
        payload: { targetUserId: auction.sellerId, assetId: auction.assetId, reason: "资料不完整", evidence: "截图" }
      });
      const reportId = created.json().report.id as string;

      const response = await app.inject({
        method: "POST",
        url: `/admin/reports/${reportId}/reject`,
        headers: { authorization: `Bearer ${reviewer}` },
        payload: { note: "证据不足" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().report).toMatchObject({
        id: reportId,
        status: "rejected",
        confirmedByAdminId: 1
      });

      const list = await app.inject({
        method: "GET",
        url: "/admin/reports",
        headers: { authorization: `Bearer ${reviewer}` }
      });
      expect(list.json().items).toEqual([
        expect.objectContaining({
          id: reportId,
          status: "rejected",
          reporterDisplayName: "出价人"
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("requires violation publish permission for publishing routes", async () => {
    const app = buildApp({ enableMockAuth: true });

    try {
      const auction = await createReportableAuction(app);
      const operator = await adminToken(app, "operator", "operator-pass");
      const created = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${auction.bidderToken}` },
        payload: { targetUserId: auction.sellerId, assetId: auction.assetId, reason: "恶意竞价", evidence: "出价记录" }
      });

      const response = await app.inject({
        method: "POST",
        url: `/admin/reports/${created.json().report.id}/publish-violation`,
        headers: { authorization: `Bearer ${operator}` }
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});
