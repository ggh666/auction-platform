import { useEffect, useState, type FormEvent } from "react";
import {
  centsToYuanText,
  dragonBallProfessionOptions,
  dragonBallQualityOptions,
  type ExchangeResource,
  type ExchangeResourceListResponse,
  type ExchangeResourceStatus
} from "@auction/shared";
import { adminGet } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";

type ExchangeResourceFilters = {
  keyword: string;
  status: "" | ExchangeResourceStatus;
  dragonBallProfession: string;
  dragonBallQuality: string;
};

const pageSize = 20;

const emptyFilters: ExchangeResourceFilters = {
  keyword: "",
  status: "",
  dragonBallProfession: "",
  dragonBallQuality: ""
};

const statusOptions: Array<{ value: "" | ExchangeResourceStatus; label: string }> = [
  { value: "", label: "全部状态" },
  { value: "pending_image_review", label: "图片审核中" },
  { value: "active", label: "展示中" },
  { value: "closed", label: "已关闭" },
  { value: "removed", label: "已下架" },
  { value: "expired", label: "已过期" }
];

const statusMeta: Record<ExchangeResourceStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  pending_image_review: { label: "图片审核中", tone: "warning" },
  active: { label: "展示中", tone: "success" },
  closed: { label: "已关闭", tone: "neutral" },
  removed: { label: "已下架", tone: "danger" },
  expired: { label: "已过期", tone: "neutral" }
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function appendFilters(params: URLSearchParams, filters: ExchangeResourceFilters): void {
  const keyword = filters.keyword.trim();
  if (keyword) {
    params.set("keyword", keyword);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.dragonBallProfession) {
    params.set("dragonBallProfession", filters.dragonBallProfession);
  }
  if (filters.dragonBallQuality) {
    params.set("dragonBallQuality", filters.dragonBallQuality);
  }
}

function buildExchangeResourceListPath(page: number, filters: ExchangeResourceFilters): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  appendFilters(params, filters);
  return `/admin/exchange-resources?${params.toString()}`;
}

function renderStatus(resource: ExchangeResource) {
  const meta = statusMeta[resource.status];
  return <span className={`status ${meta.tone}`}>{meta.label}</span>;
}

function formatReferenceAmount(value: number | null): string {
  return value === null ? "未填写参考金额" : `${centsToYuanText(value)} 元宝`;
}

export function ExchangeResourcePage() {
  const [resources, setResources] = useState<ExchangeResource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ExchangeResourceFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadResources(nextPage = page, nextFilters = filters) {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<ExchangeResourceListResponse>(buildExchangeResourceListPath(nextPage, nextFilters));
      setResources(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载交换资源失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadResources(1, emptyFilters);
  }, []);

  function updateFilter<K extends keyof ExchangeResourceFilters>(key: K, value: ExchangeResourceFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadResources(1);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    void loadResources(1, emptyFilters);
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>交换资源</h3>
            <p>查看用户发布的自由交换资源，分页核对发布者、龙珠信息和交换诉求。</p>
          </div>
          <button className="primary-button" disabled={loading} onClick={() => void loadResources()} type="button">
            刷新
          </button>
        </div>
        <form className="asset-filter-bar" onSubmit={submitFilters}>
          <label>
            关键词
            <input
              onChange={(event) => updateFilter("keyword", event.target.value)}
              placeholder="标题、发布者、想换什么"
              type="search"
              value={filters.keyword}
            />
          </label>
          <label>
            状态
            <select
              onChange={(event) => updateFilter("status", event.target.value as ExchangeResourceFilters["status"])}
              value={filters.status}
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            职业
            <select onChange={(event) => updateFilter("dragonBallProfession", event.target.value)} value={filters.dragonBallProfession}>
              <option value="">全部职业</option>
              {dragonBallProfessionOptions.map((profession) => (
                <option key={profession} value={profession}>
                  {profession}
                </option>
              ))}
            </select>
          </label>
          <label>
            品质
            <select onChange={(event) => updateFilter("dragonBallQuality", event.target.value)} value={filters.dragonBallQuality}>
              <option value="">全部品质</option>
              {dragonBallQualityOptions.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>
          </label>
          <div className="filter-actions">
            <button className="primary-button" disabled={loading} type="submit">
              查询
            </button>
            <button className="ghost-button" disabled={loading} onClick={resetFilters} type="button">
              重置
            </button>
          </div>
        </form>
        {error ? <p className="notice danger">{error}</p> : null}
        <DataTable
          columns={[
            { key: "id", label: "资源编号" },
            { key: "image", label: "图片" },
            { key: "publisher", label: "发布者" },
            { key: "dragonBall", label: "龙珠信息" },
            { key: "amount", label: "参考金额" },
            { key: "want", label: "想换什么" },
            { key: "status", label: "状态" },
            { key: "createdAt", label: "发布时间" },
            { key: "expiresAt", label: "过期时间" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无交换资源"}
          getRowKey={(row) => row.id}
          rows={resources}
          renderCell={(row, column) => {
            if (column.key === "id") {
              return (
                <div className="stacked-cell">
                  <strong>{row.title}</strong>
                  <span>资源编号 {row.id}</span>
                  <span>
                    {row.gameName} / {row.serverName || "未填写区服"}
                  </span>
                </div>
              );
            }

            if (column.key === "image") {
              return row.imageUrl ? (
                <img alt={`${row.title} 图片`} className="exchange-resource-thumbnail" src={row.imageUrl} />
              ) : (
                <span className="muted">暂无图片</span>
              );
            }

            if (column.key === "publisher") {
              return (
                <div className="stacked-cell">
                  <strong>{row.publisher?.displayName || "未命名用户"}</strong>
                  <span>用户ID {row.publisherId}</span>
                </div>
              );
            }

            if (column.key === "dragonBall") {
              return (
                <div className="stacked-cell">
                  <strong>
                    {row.dragonBall.element}系 / {row.dragonBall.profession} / {row.dragonBall.quality}品质
                  </strong>
                  <span>{row.dragonBall.attributes}</span>
                </div>
              );
            }

            if (column.key === "amount") {
              return formatReferenceAmount(row.dragonBallAmountCents);
            }

            if (column.key === "want") {
              return (
                <div className="stacked-cell">
                  <strong>{row.desiredExchange}</strong>
                  <span>{row.description || "暂无补充说明"}</span>
                </div>
              );
            }

            if (column.key === "status") {
              return renderStatus(row);
            }

            if (column.key === "createdAt") {
              return formatTime(row.createdAt);
            }

            if (column.key === "expiresAt") {
              return formatTime(row.expiresAt);
            }

            return row.id;
          }}
        />
        <PaginationBar loading={loading} onPageChange={(nextPage) => void loadResources(nextPage)} page={page} pageSize={pageSize} total={total} />
      </div>
    </section>
  );
}
