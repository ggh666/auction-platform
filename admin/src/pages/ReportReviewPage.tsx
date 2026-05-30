import { useEffect, useState } from "react";
import { adminGet, adminPost } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";

const pageSize = 20;

type ReportRecord = {
  id: string;
  reporterUserId: string;
  reporterDisplayName?: string;
  targetUserId: string;
  assetId: string | null;
  reason: string;
  evidence: string;
  status: "pending" | "rejected" | "confirmed";
  confirmedByAdminId: number | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReportsResponse = {
  items: ReportRecord[];
  total: number;
  page: number;
  pageSize: number;
};

type ReportActionResponse = {
  report: ReportRecord;
};

type ReportReviewPageProps = {
  onOpenAsset: (assetId: string) => void;
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusLabel(status: ReportRecord["status"]) {
  if (status === "confirmed") {
    return <span className="status success">已确认</span>;
  }
  if (status === "rejected") {
    return <span className="status danger">已驳回</span>;
  }
  return <span className="status warning">待审核</span>;
}

export function ReportReviewPage({ onOpenAsset }: ReportReviewPageProps) {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReports(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<ReportsResponse>(`/admin/reports?page=${nextPage}&pageSize=${pageSize}`);
      setReports(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载举报列表失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports(1);
  }, []);

  async function confirm(reportId: string) {
    setActingId(reportId);
    setError(null);
    try {
      const response = await adminPost<ReportActionResponse>(`/admin/reports/${reportId}/confirm`);
      setReports((current) => current.map((report) => (report.id === reportId ? { ...report, ...response.report } : report)));
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "确认违规失败");
    } finally {
      setActingId(null);
    }
  }

  async function publish(reportId: string) {
    setActingId(reportId);
    setError(null);
    try {
      await adminPost(`/admin/reports/${reportId}/publish-violation`);
      await loadReports(page);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "发布违规公示失败");
    } finally {
      setActingId(null);
    }
  }

  async function reject(reportId: string) {
    const note = window.prompt("请输入驳回原因", "证据不足")?.trim();
    if (note === undefined) {
      return;
    }

    setActingId(reportId);
    setError(null);
    try {
      const response = await adminPost<ReportActionResponse>(`/admin/reports/${reportId}/reject`, { note });
      setReports((current) => current.map((report) => (report.id === reportId ? { ...report, ...response.report } : report)));
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "驳回举报失败");
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>举报审核</h3>
            <p>数据来自当前 API 的举报记录，确认后可发布到违规公示。</p>
          </div>
          <button className="primary-button" disabled={loading} onClick={() => void loadReports(page)} type="button">
            刷新
          </button>
        </div>
        {error ? <p className="notice danger">{error}</p> : null}
        <DataTable
          columns={[
            { key: "id", label: "举报编号" },
            { key: "targetUserId", label: "被举报用户ID" },
            { key: "reason", label: "举报原因" },
            { key: "reporter", label: "举报人" },
            { key: "asset", label: "关联资产" },
            { key: "evidence", label: "证据" },
            { key: "submittedAt", label: "提交时间" },
            { key: "status", label: "状态" },
            { key: "actions", label: "操作", align: "center" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无举报记录"}
          rows={reports}
          getRowKey={(row) => row.id}
          renderCell={(row, column) => {
            if (column.key === "actions") {
              const disabled = actingId === row.id;
              return (
                <div className="inline-actions">
                  <button disabled={disabled || row.status !== "pending"} onClick={() => void confirm(row.id)} type="button">
                    确认
                  </button>
                  <button
                    disabled={disabled || row.status !== "confirmed"}
                    onClick={() => void publish(row.id)}
                    type="button"
                  >
                    公示
                  </button>
                  <button disabled={disabled || row.status !== "pending"} onClick={() => void reject(row.id)} type="button">
                    驳回
                  </button>
                </div>
              );
            }

            if (column.key === "submittedAt") {
              return formatTime(row.createdAt);
            }

            if (column.key === "reporter") {
              return row.reporterDisplayName ? `${row.reporterDisplayName}（ID：${row.reporterUserId}）` : row.reporterUserId;
            }

            if (column.key === "asset") {
              const assetId = row.assetId;
              if (!assetId) {
                return <span className="muted">无关联资产</span>;
              }
              return (
                <button className="link-button" onClick={() => onOpenAsset(assetId)} type="button">
                  关联资产 ID：{assetId}
                </button>
              );
            }

            if (column.key === "status") {
              return statusLabel(row.status);
            }

            return row[column.key as keyof ReportRecord] as string;
          }}
        />
        <PaginationBar loading={loading} onPageChange={(nextPage) => void loadReports(nextPage)} page={page} pageSize={pageSize} total={total} />
      </div>
    </section>
  );
}
