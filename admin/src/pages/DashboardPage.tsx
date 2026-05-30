import { useEffect, useState } from "react";
import type { AdminDashboardResponse, AdminDashboardMetrics, AuctionAsset } from "@auction/shared";
import { centsToYuanText } from "@auction/shared";
import { adminGet } from "../api/client";
import { DataTable } from "../components/DataTable";

type MetricItem = {
  key: keyof AdminDashboardMetrics;
  label: string;
  hint: string;
};

type PendingReport = AdminDashboardResponse["pendingReports"][number];

type DashboardPageProps = {
  onOpenAsset: (assetId: string) => void;
};

const metricItems: MetricItem[] = [
  { key: "pendingAssets", label: "待审核资产", hint: "需要运营审核后才会上架" },
  { key: "activeAssets", label: "进行中交换", hint: "当前可被用户浏览和出价" },
  { key: "pendingReports", label: "待处理举报", hint: "需要确认或驳回的举报" },
  { key: "bannedUsers", label: "封禁用户", hint: "当前被限制的平台用户" },
  { key: "totalUsers", label: "总用户", hint: "平台注册用户总数" },
  { key: "todayNewUsers", label: "今日新增用户", hint: "按北京时间自然日统计" },
  { key: "todayPublishedAssets", label: "今日发布资产", hint: "今日提交的资产记录" },
  { key: "todayBids", label: "今日出价", hint: "今日产生的竞价记录" }
];

function formatMoney(cents: number): string {
  return `¥${centsToYuanText(cents)}`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderAssetCell(row: AuctionAsset, key: string, onOpenAsset: (assetId: string) => void) {
  if (key === "title") {
    return (
      <div className="stacked-cell">
        <button className="link-button strong-link" onClick={() => onOpenAsset(row.id)} type="button">
          {row.title}
        </button>
        <span>{row.gameName} / {row.assetType}</span>
      </div>
    );
  }

  if (key === "price") {
    return formatMoney(row.startingPriceCents);
  }

  if (key === "createdAt") {
    return formatTime(row.createdAt);
  }

  return row[key as keyof AuctionAsset] as string;
}

function renderReportCell(row: PendingReport, key: string, onOpenAsset: (assetId: string) => void) {
  if (key === "reason") {
    return (
      <div className="stacked-cell">
        <strong>{row.reason}</strong>
        <span>举报人：{row.reporterUserId}</span>
      </div>
    );
  }

  if (key === "createdAt") {
    return formatTime(row.createdAt);
  }

  if (key === "asset") {
    const assetId = row.assetId;
    if (!assetId) {
      return <span className="muted">无关联资产</span>;
    }
    return (
      <button className="link-button" onClick={() => onOpenAsset(assetId)} type="button">
        资产 {assetId}
      </button>
    );
  }

  return row[key as keyof PendingReport];
}

export function DashboardPage({ onOpenAsset }: DashboardPageProps) {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<AdminDashboardResponse>("/admin/dashboard");
      setDashboard(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载仪表盘失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const metrics = dashboard?.metrics;

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>运营概览</h3>
            <p>汇总待处理事项、用户风险和今日平台动态。</p>
          </div>
          <button className="primary-button" disabled={loading} onClick={() => void loadDashboard()} type="button">
            刷新
          </button>
        </div>
        {error ? <p className="notice danger">{error}</p> : null}
        <div className="metric-grid dashboard-metrics">
          {metricItems.map((item) => (
            <div className="metric-card" key={item.key}>
              <p>{item.label}</p>
              <strong>{metrics ? metrics[item.key] : "-"}</strong>
              <span>{item.hint}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>待审核资产</h3>
              <p>最新提交的资产，最多展示 5 条。</p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: "title", label: "资产" },
              { key: "sellerId", label: "卖家ID" },
              { key: "price", label: "底价", align: "right" },
              { key: "createdAt", label: "提交时间" }
            ]}
            emptyText={loading ? "正在加载..." : "暂无待审核资产"}
            getRowKey={(row) => row.id}
            rows={dashboard?.pendingAssets ?? []}
            renderCell={(row, column) => renderAssetCell(row, column.key, onOpenAsset)}
          />
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>待处理举报</h3>
              <p>最新待确认举报，最多展示 5 条。</p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: "id", label: "编号" },
              { key: "targetUserId", label: "被举报用户" },
              { key: "reason", label: "原因" },
              { key: "asset", label: "关联资产" },
              { key: "createdAt", label: "提交时间" }
            ]}
            emptyText={loading ? "正在加载..." : "暂无待处理举报"}
            getRowKey={(row) => row.id}
            rows={dashboard?.pendingReports ?? []}
            renderCell={(row, column) => renderReportCell(row, column.key, onOpenAsset)}
          />
        </div>
      </div>
    </section>
  );
}
