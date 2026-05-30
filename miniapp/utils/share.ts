export type ShareAppTarget = {
  title: string;
  path: string;
  imageUrl?: string;
};

export type ShareTimelineTarget = {
  title: string;
  query: string;
  imageUrl?: string;
};

type AssetListShareInput = {
  gameName: string;
  assetType?: string;
  keyword?: string;
};

type AssetDetailShareInput = {
  assetId: string;
  title?: string;
  gameName?: string;
  imageUrls?: string[];
};

function encodeQuery(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = encodeQuery(params);
  return query ? `${path}?${query}` : path;
}

function firstUsableImage(imageUrls: string[] | undefined): string | undefined {
  return imageUrls?.map((imageUrl) => imageUrl.trim()).find(Boolean);
}

export function buildHomeShare(): ShareAppTarget {
  return {
    title: "塔防精灵账号与道具交换",
    path: "/pages/games/index"
  };
}

export function buildAssetListShare(input: AssetListShareInput): ShareAppTarget {
  const gameName = input.gameName.trim() || "塔防精灵";
  const assetType = input.assetType?.trim();
  return {
    title: `${gameName}${assetType ? `${assetType}` : "资产"}交换`,
    path: withQuery("/pages/auctions/list", {
      gameName,
      assetType,
      keyword: input.keyword?.trim()
    })
  };
}

export function buildAssetDetailShare(input: AssetDetailShareInput): ShareAppTarget {
  if (!input.assetId.trim()) {
    return buildHomeShare();
  }
  const title = input.title?.trim() || "交换宝贝详情";
  const gameName = input.gameName?.trim() || "塔防精灵";
  const imageUrl = firstUsableImage(input.imageUrls);
  return {
    title: `${title} - ${gameName}交换`,
    path: withQuery("/pages/auctions/detail", { assetId: input.assetId.trim() }),
    ...(imageUrl ? { imageUrl } : {})
  };
}

export function toTimelineShare(target: ShareAppTarget): ShareTimelineTarget {
  const query = target.path.includes("?") ? target.path.slice(target.path.indexOf("?") + 1) : "";
  return {
    title: target.title,
    query,
    ...(target.imageUrl ? { imageUrl: target.imageUrl } : {})
  };
}
