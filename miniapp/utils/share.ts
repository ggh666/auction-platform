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

type GameModeShareInput = {
  gameName: string;
};

type ExchangeResourceListShareInput = {
  gameName: string;
  dragonBallProfession?: string;
  dragonBallQuality?: string;
  keyword?: string;
};

type PriceReferenceShareInput = {
  gameName: string;
  profession?: string;
  quality?: string;
};

type AssetDetailShareInput = {
  assetId: string;
  title?: string;
  gameName?: string;
  imageUrls?: string[];
};

type ExchangeResourceDetailShareInput = {
  resourceId: string;
  title?: string;
  gameName?: string;
  imageUrl?: string;
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

export function buildGameModeShare(input: GameModeShareInput): ShareAppTarget {
  const gameName = input.gameName.trim() || "塔防精灵";
  return {
    title: `${gameName}交换方式`,
    path: withQuery("/pages/games/mode", { gameName })
  };
}

export function buildExchangeResourceListShare(input: ExchangeResourceListShareInput): ShareAppTarget {
  const gameName = input.gameName.trim() || "塔防精灵";
  return {
    title: `${gameName}龙珠自由交换`,
    path: withQuery("/pages/exchange/list", {
      gameName,
      dragonBallProfession: input.dragonBallProfession?.trim(),
      dragonBallQuality: input.dragonBallQuality?.trim(),
      keyword: input.keyword?.trim()
    })
  };
}

export function buildPriceReferenceShare(input: PriceReferenceShareInput): ShareAppTarget {
  const gameName = input.gameName.trim() || "塔防精灵";
  return {
    title: `${gameName}龙珠估值参考`,
    path: withQuery("/pages/priceReference/index", {
      gameName,
      profession: input.profession?.trim(),
      quality: input.quality?.trim()
    })
  };
}

export function buildGuidesShare(): ShareAppTarget {
  return {
    title: "塔防精灵攻略工具",
    path: "/pages/guides/index"
  };
}

export function buildRedeemCodesShare(): ShareAppTarget {
  return {
    title: "塔防精灵兑换码",
    path: "/pages/guides/redeem-codes"
  };
}

export function buildDragonBallSystemShare(): ShareAppTarget {
  return {
    title: "塔防精灵龙珠体系",
    path: "/pages/guides/dragon-ball-system"
  };
}

export function buildDeepSeaBattleShare(): ShareAppTarget {
  return {
    title: "塔防精灵深海之战",
    path: "/pages/guides/deep-sea-battle"
  };
}

export function buildDeepSeaBossShare(input: { section: number; level: number; bossName?: string }): ShareAppTarget {
  const section = Number.isFinite(input.section) ? String(input.section) : "";
  const level = Number.isFinite(input.level) ? String(input.level) : "";
  const bossName = input.bossName?.trim() || deepSeaBossShareName(input.section);
  return {
    title: `深海之战·${bossName}${level ? `${level}关` : ""}`,
    path: withQuery("/pages/guides/deep-sea-boss", { section, level })
  };
}

function deepSeaBossShareName(section: number): string {
  const names: Record<number, string> = {
    1: "魔鬼",
    2: "典狱长",
    3: "禁卫",
    4: "乌贼",
    5: "异兽",
    6: "魅影",
    7: "公主",
    8: "刺豚",
    9: "怪人",
    10: "简",
    11: "王城"
  };
  return names[section] ?? "BOSS";
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

export function buildExchangeResourceDetailShare(input: ExchangeResourceDetailShareInput): ShareAppTarget {
  if (!input.resourceId.trim()) {
    return buildHomeShare();
  }
  const title = input.title?.trim() || "自由交换资源";
  const gameName = input.gameName?.trim() || "塔防精灵";
  const imageUrl = input.imageUrl?.trim();
  return {
    title: `${title} - ${gameName}自由交换`,
    path: withQuery("/pages/exchange/detail", { resourceId: input.resourceId.trim() }),
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
