import { useEffect, useMemo, useState } from "react";
import { centsToYuanText, firstAssetImageUrl, type AuctionAsset } from "@auction/shared";
import { adminGet, adminPost } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PaginationBar } from "../components/PaginationBar";

const pageSize = 20;

type AssetReviewResponse = {
  items: AuctionAsset[];
  total: number;
  page: number;
  pageSize: number;
};

type AssetActionResponse = {
  asset: AuctionAsset;
};

type CreditDeductionResponse = {
  user: {
    id: string;
    creditScore: number;
  };
};

type BatchReviewFailure = {
  assetId: string;
  code: string;
  message: string;
};

type BatchReviewResponse = {
  succeeded: AuctionAsset[];
  failed: BatchReviewFailure[];
};

type AssetReviewPageProps = {
  onOpenAsset: (assetId: string) => void;
};

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

export function AssetReviewPage({ onOpenAsset }: AssetReviewPageProps) {
  const [assets, setAssets] = useState<AuctionAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [batching, setBatching] = useState<"approve" | "reject" | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AuctionAsset | null>(null);
  const selectedIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  async function loadAssets(nextPage = page) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await adminGet<AssetReviewResponse>(`/admin/assets/review?page=${nextPage}&pageSize=${pageSize}`);
      setAssets(response.items);
      setTotal(response.total);
      setPage(response.page);
      setSelectedAssetIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载资产审核队列失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssets(1);
  }, []);

  function isPendingImageSafetyError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes("图片安全检测尚未完成") || error.message.includes("Image safety check is not passed"))
    );
  }

  async function approve(assetId: string, input: { imageSafetyOverride?: boolean } = {}) {
    setActingId(assetId);
    setError(null);
    setNotice(null);
    try {
      await adminPost<AssetActionResponse>(
        `/admin/assets/${assetId}/approve`,
        input.imageSafetyOverride ? { imageSafetyOverride: true } : undefined
      );
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      setTotal((current) => Math.max(0, current - 1));
      setSelectedAssetIds((current) => current.filter((id) => id !== assetId));
    } catch (approveError) {
      if (
        !input.imageSafetyOverride &&
        isPendingImageSafetyError(approveError) &&
        window.confirm("图片安全检测尚未完成。若已人工查看图片并确认无违规内容，是否继续通过？")
      ) {
        await approve(assetId, { imageSafetyOverride: true });
        return;
      }
      setError(approveError instanceof Error ? approveError.message : "审核通过失败");
    } finally {
      setActingId(null);
    }
  }

  async function reject(assetId: string) {
    const note = window.prompt("请输入驳回原因", "资料不完整")?.trim();
    if (note === undefined) {
      return;
    }

    setActingId(assetId);
    setError(null);
    setNotice(null);
    try {
      await adminPost<AssetActionResponse>(`/admin/assets/${assetId}/reject`, { note });
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      setTotal((current) => Math.max(0, current - 1));
      setSelectedAssetIds((current) => current.filter((id) => id !== assetId));
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "驳回失败");
    } finally {
      setActingId(null);
    }
  }

  async function deductCredit(asset: AuctionAsset) {
    const reason = window.prompt("请输入扣减信誉分原因", "审核发现违规信息")?.trim();
    if (reason === undefined) {
      return;
    }

    setActingId(asset.id);
    setError(null);
    setNotice(null);
    try {
      const response = await adminPost<CreditDeductionResponse>(`/admin/assets/${asset.id}/deduct-credit`, { reason });
      setNotice(`已扣减卖家 ${asset.sellerId} 信誉分 5 分，当前信誉分 ${response.user.creditScore}`);
    } catch (deductError) {
      setError(deductError instanceof Error ? deductError.message : "扣减信誉分失败");
    } finally {
      setActingId(null);
    }
  }

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    );
  }

  function selectCurrentPage() {
    setSelectedAssetIds(assets.map((asset) => asset.id));
  }

  function clearSelection() {
    setSelectedAssetIds([]);
  }

  async function batchReview(action: "approve" | "reject") {
    if (selectedAssetIds.length === 0) {
      setNotice(null);
      setError("请先选择需要批量处理的资产");
      return;
    }

    const note = action === "reject" ? window.prompt("请输入批量驳回原因", "资料不完整")?.trim() : "";
    if (note === undefined) {
      return;
    }

    setBatching(action);
    setError(null);
    setNotice(null);
    try {
      const response = await adminPost<BatchReviewResponse>("/admin/assets/review/batch", {
        action,
        assetIds: selectedAssetIds,
        note
      });
      const succeededIds = new Set(response.succeeded.map((asset) => asset.id));
      setAssets((current) => current.filter((asset) => !succeededIds.has(asset.id)));
      setTotal((current) => Math.max(0, current - succeededIds.size));
      setSelectedAssetIds((current) => current.filter((assetId) => !succeededIds.has(assetId)));
      if (response.failed.length > 0) {
        setError(`已处理 ${response.succeeded.length} 条，失败 ${response.failed.length} 条：${response.failed[0].message}`);
      }
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "批量审核失败");
    } finally {
      setBatching(null);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>资产审核队列</h3>
            <p>数据来自当前 API 的待审核资产，处理后会从队列移除。</p>
          </div>
          <button className="primary-button" disabled={loading} onClick={() => void loadAssets(page)} type="button">
            刷新
          </button>
        </div>
        {notice ? <p className="notice success">{notice}</p> : null}
        {error ? <p className="notice danger">{error}</p> : null}
        <div className="batch-action-bar">
          <span>已选择 {selectedAssetIds.length} 条</span>
          <div className="inline-actions">
            <button disabled={loading || assets.length === 0} onClick={selectCurrentPage} type="button">
              全选本页
            </button>
            <button disabled={selectedAssetIds.length === 0 || batching !== null} onClick={clearSelection} type="button">
              清空
            </button>
            <button
              className="primary-button"
              disabled={selectedAssetIds.length === 0 || batching !== null}
              onClick={() => void batchReview("approve")}
              type="button"
            >
              批量通过
            </button>
            <button
              disabled={selectedAssetIds.length === 0 || batching !== null}
              onClick={() => void batchReview("reject")}
              type="button"
            >
              批量驳回
            </button>
          </div>
        </div>
        <DataTable
          columns={[
            { key: "select", label: "选择", align: "center" },
            { key: "id", label: "资产编号" },
            { key: "images", label: "图片" },
            { key: "title", label: "资产标题" },
            { key: "game", label: "游戏与区服" },
            { key: "sellerId", label: "卖家ID" },
            { key: "price", label: "起拍价", align: "right" },
            { key: "submittedAt", label: "提交时间" },
            { key: "status", label: "状态" },
            { key: "actions", label: "操作", align: "center" }
          ]}
          emptyText={loading ? "正在加载..." : "暂无待审核资产"}
          rows={assets}
          getRowKey={(row) => row.id}
          renderCell={(row, column) => {
            if (column.key === "select") {
              return (
                <input
                  aria-label={`选择资产 ${row.id}`}
                  checked={selectedIdSet.has(row.id)}
                  disabled={actingId === row.id || batching !== null}
                  onChange={() => toggleAsset(row.id)}
                  type="checkbox"
                />
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

            if (column.key === "actions") {
              const disabled = actingId === row.id;
              return (
                <div className="inline-actions">
                  <button disabled={disabled} onClick={() => void approve(row.id)} type="button">
                    通过
                  </button>
                  <button disabled={disabled} onClick={() => void reject(row.id)} type="button">
                    驳回
                  </button>
                  <button disabled={disabled} onClick={() => void deductCredit(row)} type="button">
                    扣信誉
                  </button>
                </div>
              );
            }

            if (column.key === "id") {
              return (
                <button className="link-button" onClick={() => onOpenAsset(row.id)} type="button">
                  {row.id}
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
                </div>
              );
            }

            if (column.key === "game") {
              return `${row.gameName} / ${row.serverName} / ${row.assetType}`;
            }

            if (column.key === "price") {
              return formatMoney(row.startingPriceCents);
            }

            if (column.key === "submittedAt") {
              return formatTime(row.createdAt);
            }

            if (column.key === "status") {
              return <span className="status warning">待审核</span>;
            }

            return row[column.key as keyof AuctionAsset] as string;
          }}
        />
        <PaginationBar loading={loading} onPageChange={(nextPage) => void loadAssets(nextPage)} page={page} pageSize={pageSize} total={total} />
      </div>
      {previewAsset ? (
        <div className="modal-backdrop" onClick={() => setPreviewAsset(null)} role="presentation">
          <div
            aria-labelledby="asset-preview-title"
            aria-modal="true"
            className="image-preview-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <h3 id="asset-preview-title">{previewAsset.title}</h3>
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
    </>
  );
}
