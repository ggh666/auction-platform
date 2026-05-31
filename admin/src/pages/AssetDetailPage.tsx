import { useEffect, useState } from "react";
import {
  centsToYuanText,
  type AdminAssetDetailResponse,
  type AdminImageSafetyCheck,
  type AssetStatus,
  type AuctionAsset,
  type BidDisplayRecord,
  type ImageSafetyStatus,
  type PrincipalSummary,
  type UserSummary
} from "@auction/shared";
import { adminGet, adminPost } from "../api/client";
import { DataTable } from "../components/DataTable";

type AssetDetailPageProps = {
  assetId: string;
  onBack: () => void;
};

const statusMeta: Record<AssetStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  draft: { label: "草稿", tone: "neutral" },
  pending_review: { label: "待审核", tone: "warning" },
  active: { label: "已上架", tone: "success" },
  ended: { label: "已结束", tone: "neutral" },
  rejected: { label: "已拒绝", tone: "danger" },
  cancelled: { label: "已取消", tone: "neutral" },
  removed: { label: "已移除", tone: "danger" }
};

const imageSafetyMeta: Record<ImageSafetyStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  missing: { label: "未检测", tone: "danger" },
  pending: { label: "待回调", tone: "warning" },
  pass: { label: "已通过", tone: "success" },
  review: { label: "人工复核", tone: "warning" },
  risky: { label: "违规", tone: "danger" },
  failed: { label: "检测失败", tone: "danger" }
};

function formatMoney(cents: number | null): string {
  return cents === null ? "未出价" : `¥${centsToYuanText(cents)}`;
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

function usableImageUrls(asset: AuctionAsset): string[] {
  return asset.imageUrls.map((imageUrl) => imageUrl.trim()).filter(Boolean);
}

function missingImageSafetyCheck(publicUrl: string): AdminImageSafetyCheck {
  return {
    publicUrl,
    objectKey: null,
    status: "missing",
    traceId: null,
    label: null,
    updatedAt: null
  };
}

function imageSafetyForUrl(checks: AdminImageSafetyCheck[], imageUrl: string): AdminImageSafetyCheck {
  return checks.find((check) => check.publicUrl === imageUrl) ?? missingImageSafetyCheck(imageUrl);
}

function renderImageSafetyBadge(check: AdminImageSafetyCheck) {
  const meta = imageSafetyMeta[check.status];
  const label = check.label === null ? meta.label : `${meta.label}（${check.label}）`;
  return (
    <span className={`status ${meta.tone}`} title={check.traceId ? `trace_id: ${check.traceId}` : undefined}>
      {label}
    </span>
  );
}

function dragonBallSummary(asset: AuctionAsset): string {
  const dragonBall = asset.dragonBall;
  if (!dragonBall) {
    return "";
  }
  return `${dragonBall.element}系 / ${dragonBall.profession} / ${dragonBall.quality}品质 / ${dragonBall.attributes}`;
}

export function AssetDetailPage({ assetId, onBack }: AssetDetailPageProps) {
  const [asset, setAsset] = useState<AuctionAsset | null>(null);
  const [seller, setSeller] = useState<UserSummary | null>(null);
  const [principal, setPrincipal] = useState<PrincipalSummary | null>(null);
  const [imageSafetyChecks, setImageSafetyChecks] = useState<AdminImageSafetyCheck[]>([]);
  const [recentBids, setRecentBids] = useState<BidDisplayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deductingCredit, setDeductingCredit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadAsset() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await adminGet<AdminAssetDetailResponse>(`/admin/assets/${assetId}`);
      setAsset(response.asset);
      setSeller(response.seller);
      setPrincipal(response.principal);
      setImageSafetyChecks(response.imageSafetyChecks);
      setRecentBids(response.recentBids);
    } catch (loadError) {
      setAsset(null);
      setSeller(null);
      setPrincipal(null);
      setImageSafetyChecks([]);
      setRecentBids([]);
      setError(loadError instanceof Error ? loadError.message : "加载资产详情失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAsset();
  }, [assetId]);

  const images = asset ? usableImageUrls(asset) : [];

  async function deductCredit() {
    if (!asset) {
      return;
    }
    const reason = window.prompt("请输入扣减信誉分原因", "审核发现违规信息")?.trim();
    if (reason === undefined) {
      return;
    }
    setDeductingCredit(true);
      setError(null);
      setNotice(null);
    try {
      const response = await adminPost<{ user: { creditScore: number } }>(`/admin/assets/${asset.id}/deduct-credit`, { reason });
      setNotice(`已扣减卖家 ${seller?.displayName ?? asset.sellerId} 信誉分 5 分，当前信誉分 ${response.user.creditScore}`);
    } catch (deductError) {
      setError(deductError instanceof Error ? deductError.message : "扣减信誉分失败");
    } finally {
      setDeductingCredit(false);
    }
  }

  return (
    <section className="page-section">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>资产详情</h3>
            <p>{asset ? `${asset.gameName} / ${asset.serverName} / ${asset.assetType}` : `资产编号：${assetId}`}</p>
          </div>
          <div className="inline-actions">
            <button className="ghost-button" onClick={onBack} type="button">
              返回
            </button>
            <button className="primary-button" disabled={loading} onClick={() => void loadAsset()} type="button">
              刷新
            </button>
            <button disabled={!asset || deductingCredit} onClick={() => void deductCredit()} type="button">
              扣信誉
            </button>
          </div>
        </div>
        {notice ? <p className="notice success">{notice}</p> : null}
        {error ? <p className="notice danger">{error}</p> : null}
        {loading && !asset ? <p className="notice">正在加载资产详情...</p> : null}
        {asset ? (
          <div className="asset-detail-body">
            {images.length > 0 ? (
              <div className="detail-image-grid">
                {images.map((imageUrl, index) => {
                  const check = imageSafetyForUrl(imageSafetyChecks, imageUrl);
                  return (
                    <div className="preview-image-card" key={`${imageUrl}-${index}`}>
                      <a className="preview-link" href={imageUrl} rel="noreferrer" target="_blank">
                        <img alt={`${asset.title} 图片 ${index + 1}`} className="detail-image" src={imageUrl} />
                      </a>
                      {renderImageSafetyBadge(check)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <span>暂无资产图片</span>
              </div>
            )}
            <div className="detail-grid">
              <div>
                <span>资产编号</span>
                <strong>{asset.id}</strong>
              </div>
              <div>
                <span>状态</span>
                <strong>{renderStatus(asset)}</strong>
              </div>
              <div>
                <span>卖家</span>
                <strong>{seller ? `${seller.displayName}（ID：${asset.sellerId}）` : `ID：${asset.sellerId}`}</strong>
              </div>
              <div>
                <span>主理人</span>
                <strong>
                  {principal
                    ? `${principal.displayName}（ID：${principal.id}）`
                    : asset.principalId
                      ? `ID：${asset.principalId}`
                      : "未分配"}
                </strong>
              </div>
              <div>
                <span>当前价</span>
                <strong>{formatMoney(asset.currentPriceCents)}</strong>
              </div>
              <div>
                <span>起拍价</span>
                <strong>{formatMoney(asset.startingPriceCents)}</strong>
              </div>
              <div>
                <span>最低加价</span>
                <strong>{formatMoney(asset.minIncrementCents)}</strong>
              </div>
              <div>
                <span>截止时间</span>
                <strong>{formatTime(asset.effectiveEndAt)}</strong>
              </div>
              <div>
                <span>创建时间</span>
                <strong>{formatTime(asset.createdAt)}</strong>
              </div>
            </div>
            <div className="detail-section">
              <span>资产标题</span>
              <strong>{asset.title}</strong>
            </div>
            <div className="detail-section">
              <span>资产描述</span>
              <p>{asset.description}</p>
            </div>
            {dragonBallSummary(asset) ? (
              <div className="detail-section">
                <span>龙珠信息</span>
                <strong>{dragonBallSummary(asset)}</strong>
              </div>
            ) : null}
            <div className="detail-section">
              <span>竞拍信息</span>
              <div className="bid-summary-row">
                <strong>当前竞拍价：{formatMoney(asset.currentPriceCents)}</strong>
                <strong>最高出价用户：{asset.highestBidderId ?? "暂无"}</strong>
              </div>
              <DataTable
                columns={[
                  { key: "createdAt", label: "出价时间" },
                  { key: "bidder", label: "出价用户" },
                  { key: "amountCents", label: "出价金额", align: "right" }
                ]}
                emptyText="暂无竞拍记录"
                getRowKey={(row) => row.id}
                rows={recentBids}
                renderCell={(row, column) => {
                  if (column.key === "createdAt") {
                    return formatTime(row.createdAt);
                  }
                  if (column.key === "bidder") {
                    return (
                      <div className="stacked-cell">
                        <strong>{row.bidder.displayName}</strong>
                        <span>用户 ID：{row.bidderId}</span>
                      </div>
                    );
                  }
                  if (column.key === "amountCents") {
                    return <strong>{formatMoney(row.amountCents)}</strong>;
                  }
                  return row.id;
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
