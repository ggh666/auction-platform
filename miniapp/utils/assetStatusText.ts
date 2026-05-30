import type { AssetStatus } from "@auction/shared";

const assetStatusLabels: Record<AssetStatus, string> = {
  draft: "草稿",
  pending_review: "审核中",
  active: "已上架",
  ended: "已结束",
  rejected: "已驳回",
  cancelled: "已取消",
  removed: "已下架"
};

export function assetStatusText(status: AssetStatus): string {
  return assetStatusLabels[status];
}
