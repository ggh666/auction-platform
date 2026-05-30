import type { FastifyInstance } from "fastify";
import { requireActiveUser, requireAdmin } from "../../http/auth";
import { HttpError, badRequest, forbidden, notFound } from "../../http/errors";
import type { AdminRepository } from "../admin/admin.repository";
import { readAdminDataScope, type AdminDataScope } from "../admin/adminPrincipalScope";
import { paginateItems, readPagination, type PageQuery } from "../admin/pagination";
import type { AssetsRepository } from "../assets/assets.repository";
import type { BidsRepository } from "../bids/bids.repository";
import type { ContentSafetyService } from "../contentSafety/contentSafety.service";
import { readUserSummary } from "../users/userSummary";
import type { UsersRepository } from "../users/users.repository";
import type { PrincipalsRepository } from "../principals/principals.repository";
import type { ReportsService } from "./reports.service";

type CreateReportRequest = {
  targetUserId: string;
  assetId: string;
  reason: string;
  evidence: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCreateReportRequest(body: unknown): CreateReportRequest {
  if (!isRecord(body)) {
    throw badRequest("invalid_report", "Report payload is invalid");
  }

  const targetUserId = body.targetUserId;
  const assetId = body.assetId;
  const reason = body.reason;
  const evidence = body.evidence;
  if (typeof targetUserId !== "string" || typeof assetId !== "string" || typeof reason !== "string" || typeof evidence !== "string") {
    throw badRequest("invalid_report", "targetUserId, assetId, reason and evidence are required");
  }

  const parsed = {
    targetUserId: targetUserId.trim(),
    assetId: assetId.trim(),
    reason: reason.trim(),
    evidence: evidence.trim()
  };
  if (!parsed.targetUserId || !parsed.assetId || !parsed.reason || !parsed.evidence) {
    throw badRequest("invalid_report", "targetUserId, assetId, reason and evidence are required");
  }

  return parsed;
}

async function assertReportAllowed(input: {
  reporterUserId: string;
  targetUserId: string;
  assetId: string;
  assets: AssetsRepository;
  bids: BidsRepository;
}) {
  const asset = await input.assets.findById(input.assetId);
  if (!asset) {
    throw notFound("asset_not_found", "Asset not found");
  }

  if (asset.sellerId === input.reporterUserId) {
    throw forbidden("self_report_not_allowed", "Cannot report your own asset");
  }

  const assetBids = await input.bids.listByAsset(input.assetId);
  const reporterParticipated = assetBids.some((bid) => bid.bidderId === input.reporterUserId);
  if (!reporterParticipated) {
    throw forbidden("report_not_allowed", "Only bidders who participated in this auction can report it");
  }

  const relatedUserIds = new Set([asset.sellerId, ...assetBids.map((bid) => bid.bidderId)]);
  if (!relatedUserIds.has(input.targetUserId)) {
    throw badRequest("invalid_report_target", "Target user is not related to this auction");
  }
}

async function reportMatchesScope(report: { assetId: string | null }, assets: AssetsRepository, scope: AdminDataScope) {
  if (!scope.principalId) {
    return true;
  }
  if (!report.assetId) {
    return false;
  }
  return (await assets.findById(report.assetId, scope)) !== null;
}

async function readScopedReport(reportId: string, reports: ReportsService, assets: AssetsRepository, scope: AdminDataScope) {
  const report = (await reports.listReports()).find((item) => item.id === reportId);
  if (!report || !(await reportMatchesScope(report, assets, scope))) {
    throw notFound("report_not_found", "Report not found");
  }
  return report;
}

export function registerReportRoutes(
  app: FastifyInstance,
  reports: ReportsService,
  admins: AdminRepository,
  users: UsersRepository,
  assets: AssetsRepository,
  bids: BidsRepository,
  contentSafety: ContentSafetyService,
  principals: PrincipalsRepository
): void {
  app.post<{ Body: unknown }>("/api/reports", { preHandler: requireActiveUser(users) }, async (request) => {
    if (!request.user?.id) {
      throw new HttpError(401, "unauthorized", "Authentication required");
    }
    const user = await users.findById(Number(request.user.id));
    if (!user) {
      throw new HttpError(401, "unauthorized", "Authentication required");
    }

    const body = parseCreateReportRequest(request.body);
    await assertReportAllowed({
      reporterUserId: request.user.id,
      targetUserId: body.targetUserId,
      assetId: body.assetId,
      assets,
      bids
    });
    await contentSafety.assertTextAllowed({
      content: [body.reason, body.evidence].join("\n"),
      openid: user.openid,
      scene: 3
    });
    const report = await reports.createReport({
      reporterUserId: request.user.id,
      targetUserId: body.targetUserId,
      assetId: body.assetId,
      reason: body.reason,
      evidence: body.evidence
    });
    return { report };
  });

  app.get("/api/violations", async () => {
    return { items: await reports.listPublicViolations() };
  });

  app.get<{ Querystring: PageQuery }>("/admin/reports", { preHandler: requireAdmin("report:review", admins) }, async (request) => {
    const scope = await readAdminDataScope(request, principals);
    const { page, pageSize } = readPagination(request.query);
    if (!scope) {
      return { items: [], total: 0, page, pageSize };
    }
    const scopedReports = [];
    for (const report of await reports.listReports()) {
      if (await reportMatchesScope(report, assets, scope)) {
        scopedReports.push(report);
      }
    }
    const items = await Promise.all(
      scopedReports.map(async (report) => ({
        ...report,
        reporterDisplayName: (await readUserSummary(users, report.reporterUserId)).displayName
      }))
    );
    return paginateItems(items, page, pageSize);
  });

  app.post<{ Params: { reportId: string } }>(
    "/admin/reports/:reportId/confirm",
    { preHandler: requireAdmin("report:review", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const scope = await readAdminDataScope(request, principals);
      if (!scope) {
        throw notFound("report_not_found", "Report not found");
      }
      await readScopedReport(request.params.reportId, reports, assets, scope);
      const report = await reports.confirmReport(request.params.reportId, request.admin.id);
      return { report };
    }
  );

  app.post<{ Params: { reportId: string }; Body: { note?: unknown } }>(
    "/admin/reports/:reportId/reject",
    { preHandler: requireAdmin("report:review", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const scope = await readAdminDataScope(request, principals);
      if (!scope) {
        throw notFound("report_not_found", "Report not found");
      }
      await readScopedReport(request.params.reportId, reports, assets, scope);
      const note = typeof request.body?.note === "string" ? request.body.note.trim() : "";
      const report = await reports.rejectReport(request.params.reportId, request.admin.id, note);
      return { report };
    }
  );

  app.post<{ Params: { reportId: string } }>(
    "/admin/reports/:reportId/publish-violation",
    { preHandler: requireAdmin("violation:publish", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const scope = await readAdminDataScope(request, principals);
      if (!scope) {
        throw notFound("report_not_found", "Report not found");
      }
      await readScopedReport(request.params.reportId, reports, assets, scope);
      const violation = await reports.publishViolation(request.params.reportId, request.admin.id);
      return { violation };
    }
  );
}
