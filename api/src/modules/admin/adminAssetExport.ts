import type { AssetStatus, AuctionAsset } from "@auction/shared";

export type AdminAssetExportRow = {
  asset: AuctionAsset;
  principalName: string;
};

const statusLabels: Record<AssetStatus, string> = {
  draft: "草稿",
  pending_review: "待审核",
  active: "已上架",
  ended: "已结束",
  rejected: "已拒绝",
  cancelled: "已取消",
  removed: "已移除"
};

type ExcelValue = string | number | null;

type ExportColumn = {
  title: string;
  value: (row: AdminAssetExportRow) => ExcelValue;
};

const columns: ExportColumn[] = [
  { title: "资产编号", value: ({ asset }) => asset.id },
  { title: "标题", value: ({ asset }) => asset.title },
  { title: "游戏", value: ({ asset }) => asset.gameName },
  { title: "区服", value: ({ asset }) => asset.serverName },
  { title: "类型", value: ({ asset }) => asset.assetType },
  { title: "卖家ID", value: ({ asset }) => asset.sellerId },
  { title: "主理人", value: ({ principalName }) => principalName },
  { title: "状态", value: ({ asset }) => statusLabels[asset.status] },
  { title: "起始价", value: ({ asset }) => centsToYuan(asset.startingPriceCents) },
  { title: "当前价", value: ({ asset }) => (asset.currentPriceCents === null ? null : centsToYuan(asset.currentPriceCents)) },
  { title: "最低加价", value: ({ asset }) => centsToYuan(asset.minIncrementCents) },
  { title: "最高出价用户ID", value: ({ asset }) => asset.highestBidderId ?? "" },
  { title: "原截止时间", value: ({ asset }) => formatDateTime(asset.originalEndAt) },
  { title: "当前截止时间", value: ({ asset }) => formatDateTime(asset.effectiveEndAt) },
  { title: "创建时间", value: ({ asset }) => formatDateTime(asset.createdAt) },
  { title: "更新时间", value: ({ asset }) => formatDateTime(asset.updatedAt) },
  { title: "图片数量", value: ({ asset }) => asset.imageUrls.length },
  { title: "描述", value: ({ asset }) => asset.description }
];

function centsToYuan(cents: number): number {
  return cents / 100;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cell(value: ExcelValue): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escapeXml(value === null ? "" : String(value))}</Data></Cell>`;
}

function row(values: ExcelValue[]): string {
  return `<Row>${values.map(cell).join("")}</Row>`;
}

export function buildAdminAssetExcelWorkbook(rows: AdminAssetExportRow[]): string {
  const header = row(columns.map((column) => column.title));
  const body = rows.map((item) => row(columns.map((column) => column.value(item)))).join("");
  return `\uFEFF<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="资产数据">
    <Table>
      ${header}
      ${body}
    </Table>
  </Worksheet>
</Workbook>`;
}
