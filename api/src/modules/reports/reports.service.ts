import type { ReportStatus } from "@auction/shared";
import { badRequest, notFound } from "../../http/errors";

export type ReportRecord = {
  id: string;
  reporterUserId: string;
  targetUserId: string;
  assetId: string | null;
  reason: string;
  evidence: string;
  status: ReportStatus;
  confirmedByAdminId: number | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ViolationRecord = {
  id: string;
  reportId: string;
  targetUserId: string;
  assetId: string | null;
  reason: string;
  evidence: string;
  publishedByAdminId: number;
  publishedAt: string;
};

export type CreateReportInput = {
  reporterUserId: string;
  targetUserId: string;
  assetId: string;
  reason: string;
  evidence: string;
};

export type ReportsService = ReturnType<typeof createReportsService>;

function cloneReport(report: ReportRecord): ReportRecord {
  return { ...report };
}

function cloneViolation(violation: ViolationRecord): ViolationRecord {
  return { ...violation };
}

export function createReportsService() {
  const reports = new Map<string, ReportRecord>();
  const violations = new Map<string, ViolationRecord>();
  let nextReportId = 1;
  let nextViolationId = 1;

  return {
    async createReport(input: CreateReportInput): Promise<ReportRecord> {
      const now = new Date().toISOString();
      const report: ReportRecord = {
        id: String(nextReportId++),
        reporterUserId: input.reporterUserId,
        targetUserId: input.targetUserId,
        assetId: input.assetId,
        reason: input.reason,
        evidence: input.evidence,
        status: "pending",
        confirmedByAdminId: null,
        confirmedAt: null,
        createdAt: now,
        updatedAt: now
      };
      reports.set(report.id, cloneReport(report));
      return cloneReport(report);
    },

    async confirmReport(reportId: string, adminId: number): Promise<ReportRecord> {
      const report = reports.get(reportId);
      if (!report) {
        throw notFound("report_not_found", "Report not found");
      }
      if (report.status === "confirmed") {
        return cloneReport(report);
      }

      const now = new Date().toISOString();
      const confirmed: ReportRecord = {
        ...report,
        status: "confirmed",
        confirmedByAdminId: adminId,
        confirmedAt: now,
        updatedAt: now
      };
      reports.set(reportId, cloneReport(confirmed));
      return cloneReport(confirmed);
    },

    async rejectReport(reportId: string, adminId: number, _note?: string): Promise<ReportRecord> {
      const report = reports.get(reportId);
      if (!report) {
        throw notFound("report_not_found", "Report not found");
      }
      if (report.status === "rejected") {
        return cloneReport(report);
      }

      const now = new Date().toISOString();
      const rejected: ReportRecord = {
        ...report,
        status: "rejected",
        confirmedByAdminId: adminId,
        confirmedAt: now,
        updatedAt: now
      };
      reports.set(reportId, cloneReport(rejected));
      return cloneReport(rejected);
    },

    async publishViolation(reportId: string, adminId: number): Promise<ViolationRecord> {
      const report = reports.get(reportId);
      if (!report) {
        throw notFound("report_not_found", "Report not found");
      }
      if (report.status !== "confirmed") {
        throw badRequest("report_not_confirmed", "Only confirmed reports can be published as violations");
      }

      const existing = [...violations.values()].find((violation) => violation.reportId === reportId);
      if (existing) {
        return cloneViolation(existing);
      }

      const violation: ViolationRecord = {
        id: String(nextViolationId++),
        reportId: report.id,
        targetUserId: report.targetUserId,
        assetId: report.assetId,
        reason: report.reason,
        evidence: report.evidence,
        publishedByAdminId: adminId,
        publishedAt: new Date().toISOString()
      };
      violations.set(violation.id, cloneViolation(violation));
      return cloneViolation(violation);
    },

    async listReports(): Promise<ReportRecord[]> {
      return [...reports.values()].map(cloneReport);
    },

    async countByStatus(status: ReportStatus): Promise<number> {
      return [...reports.values()].filter((report) => report.status === status).length;
    },

    async listPublicViolations(): Promise<ViolationRecord[]> {
      return [...violations.values()].map(cloneViolation);
    }
  };
}
