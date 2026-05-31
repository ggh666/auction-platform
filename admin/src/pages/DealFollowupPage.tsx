import { useEffect, useState } from "react";
import {
  centsToYuanText,
  type AdminDealFollowupStatusRequest,
  type DealFollowupActionResponse,
  type DealFollowupItem,
  type DealFollowupListResponse
} from "@auction/shared";
import { adminGet, adminPost } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";

const pageSize = 20;

type DealFollowupPageProps = {
  onOpenAsset: (assetId: string) => void;
};

const statusOptions: Array<{ value: "" | DealFollowupItem["status"]; label: string }> = [
  { value: "", label: "全部状态" },
  { value: "pending_buyer_confirm", label: "待买家确认" },
  { value: "buyer_confirmed", label: "买家已确认" },
  { value: "buyer_abandoned", label: "买家已放弃" },
  { value: "principal_contacted", label: "主理人已联系" },
  { value: "buyer_unreachable", label: "买家失联" },
  { value: "completed", label: "已成交" },
  { value: "cancelled", label: "已取消" }
];

const statusMeta: Record<DealFollowupItem["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  pending_buyer_confirm: { label: "待买家确认", tone: "warning" },
  buyer_confirmed: { label: "买家已确认", tone: "success" },
  buyer_abandoned: { label: "买家已放弃", tone: "danger" },
  principal_contacted: { label: "主理人已联系", tone: "neutral" },
  buyer_unreachable: { label: "买家失联", tone: "danger" },
  completed: { label: "已成交", tone: "success" },
  cancelled: { label: "已取消", tone: "neutral" }
};

function formatMoney(cents: number): string {
  return `¥${centsToYuanText(cents)}`;
}

function formatTime(value: string | null): string {
  if (!value) {
    return "暂无";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderStatus(status: DealFollowupItem["status"]) {
  const meta = statusMeta[status];
  return <span className={`status ${meta.tone}`}>{meta.label}</span>;
}

function buildPath(page: number, status: "" | DealFollowupItem["status"]) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) {
    params.set("status", status);
  }
  return `/admin/deal-followups?${params.toString()}`;
}

export function DealFollowupPage({ onOpenAsset }: DealFollowupPageProps) {
  const [items, setItems] = useState<DealFollowupItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | DealFollowupItem["status"]>("");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadFollowups(nextPage = page, nextStatus = status) {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<DealFollowupListResponse>(buildPath(nextPage, nextStatus));
      setItems(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载成交跟进失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFollowups(1, "");
  }, []);

  function replaceFollowup(followup: DealFollowupItem) {
    setItems((current) => current.map((item) => (item.id === followup.id ? followup : item)));
  }

  async function updateStatus(followup: DealFollowupItem, nextStatus: AdminDealFollowupStatusRequest["status"]) {
    const meta = statusMeta[nextStatus];
    const defaultNote =
      nextStatus === "buyer_unreachable"
        ? "买家未在小程序内确认成交"
        : nextStatus === "completed"
          ? "主理人确认已成交"
          : followup.note ?? "";
    const note = window.prompt(`备注：${meta.label}`, defaultNote);
    if (note === null) {
      return;
    }
    if (nextStatus === "buyer_unreachable" && !window.confirm("确认标记买家失联？重复失联将限制该买家继续出价。")) {
      return;
    }

    setActingId(followup.id);
    setError(null);
    try {
      const response = await adminPost<DealFollowupActionResponse>(`/admin/deal-followups/${followup.id}/status`, {
        status: nextStatus,
        note
      });
      replaceFollowup(response.followup);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新成交跟进失败");
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>成交跟进</h3>
            <p>跟进已成交资产的买家确认、主理人联系和失联处理。</p>
          </div>
          <div className="inline-actions">
            <select
              onChange={(event) => {
                const nextStatus = event.target.value as "" | DealFollowupItem["status"];
                setStatus(nextStatus);
                void loadFollowups(1, nextStatus);
              }}
              value={status}
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="primary-button" disabled={loading} onClick={() => void loadFollowups()} type="button">
              刷新
            </button>
          </div>
        </div>
        {error ? <p className="notice danger">{error}</p> : null}
        <DataTable
          columns={[
            { key: "asset", label: "成交资产" },
            { key: "users", label: "买卖双方" },
            { key: "price", label: "成交价", align: "right" },
            { key: "status", label: "状态" },
            { key: "principal", label: "主理人" },
            { key: "note", label: "备注" },
            { key: "updatedAt", label: "更新时间" },
            { key: "actions", label: "操作", align: "center" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无成交跟进"}
          getRowKey={(row) => row.id}
          rows={items}
          renderCell={(row, column) => {
            if (column.key === "asset") {
              return (
                <div className="stacked-cell">
                  <button className="link-button strong-link" onClick={() => onOpenAsset(row.assetId)} type="button">
                    {row.asset.title}
                  </button>
                  <span>
                    {row.asset.gameName} / {row.asset.serverName} / {row.asset.assetType}
                  </span>
                  <span>资产编号 {row.assetId}</span>
                </div>
              );
            }

            if (column.key === "users") {
              return (
                <div className="stacked-cell">
                  <strong>买家：{row.buyer.displayName}</strong>
                  <span>买家ID {row.buyerId}</span>
                  <span>卖家ID {row.sellerId}</span>
                </div>
              );
            }

            if (column.key === "price") {
              return <strong>{formatMoney(row.finalPriceCents)}</strong>;
            }

            if (column.key === "status") {
              return renderStatus(row.status);
            }

            if (column.key === "principal") {
              return row.principal?.displayName ?? <span className="muted">未绑定</span>;
            }

            if (column.key === "note") {
              return row.note || <span className="muted">无</span>;
            }

            if (column.key === "updatedAt") {
              return (
                <div className="stacked-cell">
                  <span>{formatTime(row.updatedAt)}</span>
                  <span>买家确认 {formatTime(row.buyerConfirmedAt)}</span>
                </div>
              );
            }

            if (column.key === "actions") {
              const disabled = actingId === row.id;
              return (
                <div className="inline-actions">
                  <button disabled={disabled} onClick={() => void updateStatus(row, "principal_contacted")} type="button">
                    已联系
                  </button>
                  <button disabled={disabled} onClick={() => void updateStatus(row, "buyer_unreachable")} type="button">
                    失联
                  </button>
                  <button disabled={disabled} onClick={() => void updateStatus(row, "completed")} type="button">
                    确认成交
                  </button>
                  <button disabled={disabled} onClick={() => void updateStatus(row, "cancelled")} type="button">
                    取消
                  </button>
                </div>
              );
            }

            return row.id;
          }}
        />
        <PaginationBar loading={loading} onPageChange={(nextPage) => void loadFollowups(nextPage)} page={page} pageSize={pageSize} total={total} />
      </div>
    </section>
  );
}
