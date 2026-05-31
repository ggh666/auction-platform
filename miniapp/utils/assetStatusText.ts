import type { AssetStatus } from "@auction/shared";

type DealStatusAsset = {
  status: AssetStatus;
  currentPriceCents: number | null;
  highestBidderId?: string | null;
};

const assetStatusLabels: Record<AssetStatus, string> = {
  draft: "草稿",
  pending_review: "审核中",
  active: "已上架",
  ended: "已结束",
  rejected: "已驳回",
  cancelled: "已取消",
  removed: "已下架"
};

export function isSoldAsset(asset: DealStatusAsset): boolean {
  return asset.status === "ended" && asset.currentPriceCents !== null && Boolean(asset.highestBidderId);
}

export function assetStatusText(statusOrAsset: AssetStatus | DealStatusAsset): string {
  if (typeof statusOrAsset === "object") {
    return isSoldAsset(statusOrAsset) ? "已成交" : assetStatusLabels[statusOrAsset.status];
  }
  const status = statusOrAsset;
  return assetStatusLabels[status];
}
