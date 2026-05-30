import type { AdminDashboardPendingReport, AdminDashboardResponse } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import type { AssetsRepository } from "../assets/assets.repository";
import type { BidsRepository } from "../bids/bids.repository";
import type { PrincipalsRepository } from "../principals/principals.repository";
import type { ReportsService, ReportRecord } from "../reports/reports.service";
import type { UsersRepository } from "../users/users.repository";
import type { AdminRepository } from "./admin.repository";
import { readAdminDataScope, type AdminDataScope } from "./adminPrincipalScope";

const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;

type DashboardDeps = {
  assets: AssetsRepository;
  bids: BidsRepository;
  principals: PrincipalsRepository;
  reports: ReportsService;
  users: UsersRepository;
};

function chinaDayStartIso(now = new Date()): string {
  const shifted = new Date(now.getTime() + CHINA_TIME_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - CHINA_TIME_OFFSET_MS).toISOString();
}

function reportCreatedTime(report: ReportRecord): number {
  return new Date(report.createdAt).getTime();
}

function toPendingReport(report: ReportRecord): AdminDashboardPendingReport {
  return {
    id: report.id,
    reporterUserId: report.reporterUserId,
    targetUserId: report.targetUserId,
    assetId: report.assetId,
    reason: report.reason,
    createdAt: report.createdAt
  };
}

async function filterReportsByScope(
  reports: ReportRecord[],
  assets: AssetsRepository,
  scope: AdminDataScope
): Promise<ReportRecord[]> {
  if (!scope.principalId) {
    return reports;
  }
  const scopedReports: ReportRecord[] = [];
  for (const report of reports) {
    if (!report.assetId) {
      continue;
    }
    const asset = await assets.findById(report.assetId, scope);
    if (asset) {
      scopedReports.push(report);
    }
  }
  return scopedReports;
}

export function registerAdminDashboardRoutes(
  app: FastifyInstance,
  admins: AdminRepository,
  deps: DashboardDeps
): void {
  app.get<{ Reply: AdminDashboardResponse }>(
    "/admin/dashboard",
    { preHandler: requireAdmin("asset:view", admins) },
    async (request) => {
      const todayStart = chinaDayStartIso();
      const scope = await readAdminDataScope(request, deps.principals);
      if (!scope) {
        return {
          metrics: {
            pendingAssets: 0,
            activeAssets: 0,
            pendingReports: 0,
            bannedUsers: 0,
            totalUsers: 0,
            todayNewUsers: 0,
            todayPublishedAssets: 0,
            todayBids: 0
          },
          pendingAssets: [],
          pendingReports: [],
          generatedAt: new Date().toISOString()
        };
      }

      const pendingAssetsPromise = deps.assets.listForAdmin({ status: "pending_review", page: 1, pageSize: 5, ...scope });
      const reportsPromise = deps.reports.listReports();
      const superAdmin = !scope.principalId;

      const [
        pendingAssetsCount,
        activeAssets,
        bannedUsers,
        totalUsers,
        todayNewUsers,
        todayPublishedAssets,
        todayBids,
        pendingAssetsResult,
        reports
      ] = await Promise.all([
        deps.assets.countByStatus("pending_review", scope),
        deps.assets.countByStatus("active", scope),
        superAdmin ? deps.users.countBanned() : Promise.resolve(0),
        superAdmin ? deps.users.countAll() : Promise.resolve(0),
        superAdmin ? deps.users.countCreatedSince(todayStart) : Promise.resolve(0),
        deps.assets.countCreatedSince(todayStart, scope),
        deps.bids.countCreatedSince(todayStart, scope),
        pendingAssetsPromise,
        reportsPromise
      ]);
      const scopedReports = await filterReportsByScope(reports, deps.assets, scope);
      const scopedPendingReports = scopedReports.filter((report) => report.status === "pending");

      return {
        metrics: {
          pendingAssets: pendingAssetsCount,
          activeAssets,
          pendingReports: scopedPendingReports.length,
          bannedUsers,
          totalUsers,
          todayNewUsers,
          todayPublishedAssets,
          todayBids
        },
        pendingAssets: pendingAssetsResult.items,
        pendingReports: scopedPendingReports
          .sort((left, right) => reportCreatedTime(right) - reportCreatedTime(left) || Number(right.id) - Number(left.id))
          .slice(0, 5)
          .map(toPendingReport),
        generatedAt: new Date().toISOString()
      };
    }
  );
}
