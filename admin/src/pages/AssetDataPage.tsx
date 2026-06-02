import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  centsToYuanText,
  firstAssetImageUrl,
  type AdminAssetListResponse,
  type AssetStatus,
  type AuctionAsset
} from "@auction/shared";
import { adminDownload, adminGet, adminPost } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";

type AssetFilters = {
  keyword: string;
  status: "" | AssetStatus;
  gameName: string;
  assetType: string;
};

const pageSize = 20;

type AssetActionResponse = {
  asset: AuctionAsset;
};

type BatchRemoveFailure = {
  assetId: string;
  code: string;
  message: string;
};

type BatchRemoveResponse = {
  succeeded: AuctionAsset[];
  failed: BatchRemoveFailure[];
};

type AssetDataPageProps = {
  onOpenAsset: (assetId: string) => void;
};

const emptyFilters: AssetFilters = {
  keyword: "",
  status: "",
  gameName: "",
  assetType: ""
};

const statusOptions: Array<{ value: "" | AssetStatus; label: string }> = [
  { value: "", label: "默认：待审核 / 已上架" },
  { value: "pending_review", label: "待审核" },
  { value: "active", label: "已上架" },
  { value: "ended", label: "已结束 / 已成交" },
  { value: "rejected", label: "已拒绝" },
  { value: "cancelled", label: "已取消" },
  { value: "removed", label: "已移除" },
  { value: "draft", label: "草稿" }
];

const gameNameOptions = [
  { value: "", label: "全部游戏" },
  { value: "塔防精灵", label: "塔防精灵" }
];

const assetTypeOptions = [
  { value: "", label: "全部类型" },
  { value: "账号", label: "账号" },
  { value: "道具", label: "道具" }
];

const statusMeta: Record<AssetStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  draft: { label: "草稿", tone: "neutral" },
  pending_review: { label: "待审核", tone: "warning" },
  active: { label: "已上架", tone: "success" },
  ended: { label: "已结束", tone: "neutral" },
  rejected: { label: "已拒绝", tone: "danger" },
  cancelled: { label: "已取消", tone: "neutral" },
  removed: { label: "已移除", tone: "danger" }
};

function formatMoney(cents: number): string {
  return `¥${centsToYuanText(cents)}`;
}

function formatCurrentPrice(cents: number | null): string {
  return cents === null ? "未出价" : formatMoney(cents);
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function usableImageUrls(asset: AuctionAsset): string[] {
  return asset.imageUrls.map((imageUrl) => imageUrl.trim()).filter(Boolean);
}

function dragonBallSummary(asset: AuctionAsset): string {
  const dragonBall = asset.dragonBall;
  if (!dragonBall) {
    return "";
  }
  return `${dragonBall.element}系 / ${dragonBall.profession} / ${dragonBall.quality}品质 / ${dragonBall.attributes}`;
}

function buildAssetListPath(page: number, filters: AssetFilters): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  appendAssetFilters(params, filters);

  return `/admin/assets?${params.toString()}`;
}

function buildAssetExportPath(filters: AssetFilters): string {
  const params = new URLSearchParams();
  appendAssetFilters(params, filters);
  return `/admin/assets/export${params.size > 0 ? `?${params.toString()}` : ""}`;
}

function appendAssetFilters(params: URLSearchParams, filters: AssetFilters): void {
  const keyword = filters.keyword.trim();
  if (keyword) {
    params.set("keyword", keyword);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.gameName) {
    params.set("gameName", filters.gameName);
  }
  if (filters.assetType) {
    params.set("assetType", filters.assetType);
  }
}

function isConfirmedDeal(asset: AuctionAsset): boolean {
  return asset.status === "ended" && asset.currentPriceCents !== null && asset.highestBidderId !== null;
}

function renderStatus(asset: AuctionAsset) {
  if (isConfirmedDeal(asset)) {
    return <span className="status success">已成交</span>;
  }
  const status = asset.status;
  const meta = statusMeta[status];
  return <span className={`status ${meta.tone}`}>{meta.label}</span>;
}

export function AssetDataPage({ onOpenAsset }: AssetDataPageProps) {
  const [assets, setAssets] = useState<AuctionAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AssetFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AuctionAsset | null>(null);

  const selectedIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  async function loadAssets(nextPage = page, nextFilters = filters) {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGet<AdminAssetListResponse>(buildAssetListPath(nextPage, nextFilters));
      setAssets(response.items);
      setTotal(response.total);
      setPage(response.page);
      setSelectedAssetIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载资产数据失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssets(1, emptyFilters);
  }, []);

  function updateFilter<K extends keyof AssetFilters>(key: K, value: AssetFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadAssets(1);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    void loadAssets(1, emptyFilters);
  }

  async function removeAsset(assetId: string) {
    if (!window.confirm("确认下架该资产？下架后前台不可见，也不能继续出价。")) {
      return;
    }

    setActingId(assetId);
    setError(null);
    try {
      await adminPost<AssetActionResponse>(`/admin/assets/${assetId}/remove`);
      await loadAssets();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "下架资产失败");
    } finally {
      setActingId(null);
    }
  }

  async function confirmDealAsset(assetId: string) {
    if (!window.confirm("确认完成该交易？完成后前台会展示成交状态，买家无法继续出价。")) {
      return;
    }

    setActingId(assetId);
    setError(null);
    try {
      await adminPost<AssetActionResponse>(`/admin/assets/${assetId}/confirm-deal`);
      await loadAssets();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "完成交易失败");
    } finally {
      setActingId(null);
    }
  }

  function toggleAsset(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    if (asset?.status !== "active") {
      return;
    }
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    );
  }

  function selectCurrentPageActive() {
    setSelectedAssetIds(assets.filter((asset) => asset.status === "active").map((asset) => asset.id));
  }

  function clearSelection() {
    setSelectedAssetIds([]);
  }

  async function batchRemoveAssets() {
    if (selectedAssetIds.length === 0) {
      setError("请先选择需要下架的资产");
      return;
    }

    if (!window.confirm(`确认批量下架选中的 ${selectedAssetIds.length} 条资产？下架后前台不可见，也不能继续出价。`)) {
      return;
    }

    setBatching(true);
    setError(null);
    try {
      const response = await adminPost<BatchRemoveResponse>("/admin/assets/remove/batch", { assetIds: selectedAssetIds });
      await loadAssets();
      if (response.failed.length > 0) {
        setError(`已下架 ${response.succeeded.length} 条，失败 ${response.failed.length} 条：${response.failed[0].message}`);
      }
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "批量下架失败");
    } finally {
      setBatching(false);
    }
  }

  async function exportAssets() {
    setExporting(true);
    setError(null);
    try {
      const blob = await adminDownload(buildAssetExportPath(filters));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `asset-data-${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出资产数据失败");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>资产数据</h3>
            <p>查看全部状态资产，按运营条件筛选并分页核对。</p>
          </div>
          <div className="inline-actions">
            <button disabled={loading || exporting} onClick={() => void exportAssets()} type="button">
              {exporting ? "导出中" : "导出 Excel"}
            </button>
            <button className="primary-button" disabled={loading} onClick={() => void loadAssets()} type="button">
              刷新
            </button>
          </div>
        </div>
        <form className="asset-filter-bar" onSubmit={submitFilters}>
          <label>
            关键词
            <input
              onChange={(event) => updateFilter("keyword", event.target.value)}
              placeholder="资产编号、卖家ID或标题"
              type="search"
              value={filters.keyword}
            />
          </label>
          <label>
            状态
            <select
              onChange={(event) => updateFilter("status", event.target.value as AssetFilters["status"])}
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
            游戏名称
            <select onChange={(event) => updateFilter("gameName", event.target.value)} value={filters.gameName}>
              {gameNameOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            资产类型
            <select onChange={(event) => updateFilter("assetType", event.target.value)} value={filters.assetType}>
              {assetTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
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
        <div className="batch-action-bar">
          <span>已选择 {selectedAssetIds.length} 条</span>
          <div className="inline-actions">
            <button
              disabled={loading || batching || !assets.some((asset) => asset.status === "active")}
              onClick={selectCurrentPageActive}
              type="button"
            >
              全选可下架
            </button>
            <button disabled={selectedAssetIds.length === 0 || batching} onClick={clearSelection} type="button">
              清空
            </button>
            <button
              className="primary-button"
              disabled={selectedAssetIds.length === 0 || batching}
              onClick={() => void batchRemoveAssets()}
              type="button"
            >
              批量下架
            </button>
          </div>
        </div>
        <DataTable
          columns={[
            { key: "select", label: "选择", align: "center" },
            { key: "id", label: "资产编号" },
            { key: "images", label: "图片" },
            { key: "title", label: "资产标题" },
            { key: "game", label: "游戏与类型" },
            { key: "sellerId", label: "卖家信息" },
            { key: "price", label: "当前竞拍价", align: "right" },
            { key: "status", label: "状态" },
            { key: "effectiveEndAt", label: "截止时间" },
            { key: "createdAt", label: "创建时间" },
            { key: "actions", label: "操作", align: "center" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无资产数据"}
          getRowKey={(row) => row.id}
          rows={assets}
          renderCell={(row, column) => {
            if (column.key === "select") {
              return (
                <input
                  aria-label={`选择资产 ${row.id}`}
                  checked={selectedIdSet.has(row.id)}
                  disabled={batching || actingId === row.id || row.status !== "active"}
                  onChange={() => toggleAsset(row.id)}
                  type="checkbox"
                />
              );
            }

            if (column.key === "id") {
              return (
                <button className="link-button" onClick={() => onOpenAsset(row.id)} type="button">
                  {row.id}
                </button>
              );
            }

            if (column.key === "images") {
              const coverUrl = firstAssetImageUrl(row.imageUrls);
              const imageCount = usableImageUrls(row).length;
              if (!coverUrl) {
                return <span className="muted">无图片</span>;
              }

              return (
                <button className="image-preview-button" onClick={() => setPreviewAsset(row)} type="button">
                  <img alt={`${row.title} 首图`} className="asset-thumb" src={coverUrl} />
                  <span>{imageCount} 张</span>
                </button>
              );
            }

            if (column.key === "title") {
              return (
                <div className="stacked-cell">
                  <button className="link-button strong-link" onClick={() => onOpenAsset(row.id)} type="button">
                    {row.title}
                  </button>
                  {dragonBallSummary(row) ? <span>{dragonBallSummary(row)}</span> : null}
                  <span>{row.description || "无描述"}</span>
                </div>
              );
            }

            if (column.key === "game") {
              return (
                <div className="stacked-cell">
                  <strong>{row.gameName}</strong>
                  <span>
                    {row.serverName} / {row.assetType}
                  </span>
                </div>
              );
            }

            if (column.key === "price") {
              return (
                <div className="stacked-cell align-price">
                  <strong>{formatCurrentPrice(row.currentPriceCents)}</strong>
                  <span>起拍 {formatMoney(row.startingPriceCents)}</span>
                </div>
              );
            }

            if (column.key === "status") {
              return renderStatus(row);
            }

            if (column.key === "effectiveEndAt") {
              return formatTime(row.effectiveEndAt);
            }

            if (column.key === "createdAt") {
              return formatTime(row.createdAt);
            }

            if (column.key === "actions") {
              return (
                <div className="inline-actions">
                  <button
                    disabled={
                      actingId === row.id ||
                      batching ||
                      row.status !== "active" ||
                      row.currentPriceCents === null ||
                      row.highestBidderId === null
                    }
                    onClick={() => void confirmDealAsset(row.id)}
                    type="button"
                  >
                    完成交易
                  </button>
                  <button
                    disabled={actingId === row.id || batching || row.status !== "active"}
                    onClick={() => void removeAsset(row.id)}
                    type="button"
                  >
                    下架
                  </button>
                </div>
              );
            }

            if (column.key === "sellerId") {
              return (
                <div className="stacked-cell">
                  <strong>{row.sellerGameId || "未填写"}</strong>
                  <span>平台用户ID {row.sellerId}</span>
                </div>
              );
            }

            return row.id;
          }}
        />
        <PaginationBar loading={loading} onPageChange={(nextPage) => void loadAssets(nextPage)} page={page} pageSize={pageSize} total={total} />
      </div>
      {previewAsset ? (
        <div className="modal-backdrop" onClick={() => setPreviewAsset(null)} role="presentation">
          <div
            aria-labelledby="asset-data-preview-title"
            aria-modal="true"
            className="image-preview-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <h3 id="asset-data-preview-title">{previewAsset.title}</h3>
                <p>{usableImageUrls(previewAsset).length} 张资产图片</p>
              </div>
              <button className="ghost-button" onClick={() => setPreviewAsset(null)} type="button">
                关闭
              </button>
            </div>
            <div className="preview-grid">
              {usableImageUrls(previewAsset).map((imageUrl, index) => (
                <a className="preview-link" href={imageUrl} key={`${imageUrl}-${index}`} rel="noreferrer" target="_blank">
                  <img alt={`${previewAsset.title} 图片 ${index + 1}`} className="preview-image" src={imageUrl} />
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
