export const assetTypes = ["账号", "道具"] as const;
export type AssetType = (typeof assetTypes)[number];

export function normalizeAssetType(value: unknown): AssetType | null {
  if (typeof value !== "string") {
    return null;
  }

  const decoded = decodeQueryValue(value).trim();
  if (decoded === "账号" || decoded === "道具") {
    return decoded;
  }

  return null;
}

function decodeQueryValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
