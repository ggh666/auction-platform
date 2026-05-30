import type { ReportStatus } from "@auction/shared";
import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString } from "../../db/mysqlTypes";
import { badRequest, notFound } from "../../http/errors";
import type { CreateReportInput, ReportRecord, ViolationRecord } from "./reports.service";

type ReportDbRow = {
  id: number;
  reporter_id: number;
  target_user_id: number;
  asset_id: number | null;
  reason: string;
  evidence: string;
  status: ReportStatus;
  reviewed_by: number | null;
  reviewed_at: Date | string | null;
  created_at: Date | string;
};

type ViolationDbRow = {
  id: number;
  report_id: number | null;
  user_id: number;
  asset_id: number | null;
  title: string;
  description: string;
  published_by: number;
  published_at: Date | string;
};

function toReportRecord(row: ReportDbRow): ReportRecord {
  const reviewedAt = row.reviewed_at === null ? null : toIsoString(row.reviewed_at);
  return {
    id: String(row.id),
    reporterUserId: String(row.reporter_id),
    targetUserId: String(row.target_user_id),
    assetId: row.asset_id === null ? null : String(row.asset_id),
    reason: row.reason,
    evidence: row.evidence,
    status: row.status,
    confirmedByAdminId: row.reviewed_by,
    confirmedAt: reviewedAt,
    createdAt: toIsoString(row.created_at),
    updatedAt: reviewedAt ?? toIsoString(row.created_at)
  };
}

function toViolationRecord(row: ViolationDbRow): ViolationRecord {
  return {
    id: String(row.id),
    reportId: row.report_id === null ? "" : String(row.report_id),
    targetUserId: String(row.user_id),
    assetId: row.asset_id === null ? null : String(row.asset_id),
    reason: row.title,
    evidence: row.description,
    publishedByAdminId: Number(row.published_by),
    publishedAt: toIsoString(row.published_at)
  };
}

const reportSelect = `
  SELECT id, reporter_id, target_user_id, asset_id, reason, evidence, status, reviewed_by, reviewed_at, created_at
  FROM reports
`;

const violationSelect = `
  SELECT v.id, v.report_id, v.user_id, r.asset_id, v.title, v.description, v.published_by, v.published_at
  FROM violation_records v
  LEFT JOIN reports r ON r.id = v.report_id
`;

export function createMysqlReportsService(db: MysqlExecutor) {
  async function findReport(reportId: string): Promise<ReportRecord | null> {
    const [rows] = await db.execute<ReportDbRow[]>(`${reportSelect} WHERE id = ? LIMIT 1`, [Number(reportId)]);
    const row = firstRow<ReportDbRow>(rows);
    return row ? toReportRecord(row) : null;
  }

  return {
    async createReport(input: CreateReportInput): Promise<ReportRecord> {
      const [result] = await db.execute<MysqlResultHeader>(
        `INSERT INTO reports (reporter_id, target_user_id, asset_id, reason, evidence, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [Number(input.reporterUserId), Number(input.targetUserId), Number(input.assetId), input.reason, input.evidence]
      );
      const report = await findReport(String(result.insertId));
      if (!report) {
        throw new Error("Created report could not be read");
      }
      return report;
    },

    async confirmReport(reportId: string, adminId: number): Promise<ReportRecord> {
      const report = await findReport(reportId);
      if (!report) {
        throw notFound("report_not_found", "Report not found");
      }
      if (report.status === "confirmed") {
        return report;
      }

      await db.execute<MysqlResultHeader>(
        `UPDATE reports
         SET status = 'confirmed', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [adminId, Number(reportId)]
      );
      const confirmed = await findReport(reportId);
      if (!confirmed) {
        throw notFound("report_not_found", "Report not found");
      }
      return confirmed;
    },

    async rejectReport(reportId: string, adminId: number, note?: string): Promise<ReportRecord> {
      const report = await findReport(reportId);
      if (!report) {
        throw notFound("report_not_found", "Report not found");
      }
      if (report.status === "rejected") {
        return report;
      }

      await db.execute<MysqlResultHeader>(
        `UPDATE reports
         SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?
         WHERE id = ?`,
        [adminId, note?.trim() ? note.trim() : null, Number(reportId)]
      );
      const rejected = await findReport(reportId);
      if (!rejected) {
        throw notFound("report_not_found", "Report not found");
      }
      return rejected;
    },

    async publishViolation(reportId: string, adminId: number): Promise<ViolationRecord> {
      const report = await findReport(reportId);
      if (!report) {
        throw notFound("report_not_found", "Report not found");
      }
      if (report.status !== "confirmed") {
        throw badRequest("report_not_confirmed", "Only confirmed reports can be published as violations");
      }

      const [existingRows] = await db.execute<ViolationDbRow[]>(
        `${violationSelect} WHERE v.report_id = ? LIMIT 1`,
        [Number(reportId)]
      );
      const existing = firstRow<ViolationDbRow>(existingRows);
      if (existing) {
        return toViolationRecord(existing);
      }

      const [result] = await db.execute<MysqlResultHeader>(
        `INSERT INTO violation_records (user_id, report_id, title, description, published_by)
         VALUES (?, ?, ?, ?, ?)`,
        [Number(report.targetUserId), Number(report.id), report.reason, report.evidence, adminId]
      );
      const [rows] = await db.execute<ViolationDbRow[]>(`${violationSelect} WHERE v.id = ? LIMIT 1`, [result.insertId]);
      const violation = firstRow<ViolationDbRow>(rows);
      if (!violation) {
        throw new Error("Created violation could not be read");
      }
      return toViolationRecord(violation);
    },

    async listReports(): Promise<ReportRecord[]> {
      const [rows] = await db.execute<ReportDbRow[]>(`${reportSelect} ORDER BY created_at DESC`);
      return allRows<ReportDbRow>(rows).map(toReportRecord);
    },

    async countByStatus(status: ReportStatus): Promise<number> {
      const [rows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM reports
         WHERE status = ?`,
        [status]
      );
      const row = firstRow<{ total: number | string }>(rows);
      return row ? Number(row.total) : 0;
    },

    async listPublicViolations(): Promise<ViolationRecord[]> {
      const [rows] = await db.execute<ViolationDbRow[]>(`${violationSelect} ORDER BY v.published_at DESC`);
      return allRows<ViolationDbRow>(rows).map(toViolationRecord);
    }
  };
}
