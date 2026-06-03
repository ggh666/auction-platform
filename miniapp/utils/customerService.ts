export type CustomerServiceContact = {
  sessionFrom: string;
  sendMessageTitle: string;
  sendMessagePath: string;
  sendMessageImg: string;
  showMessageCard: boolean;
};

type SessionContext = {
  source: "profile" | "asset_detail" | "deal_followup";
  userId?: string | null;
  assetId?: string | null;
  followupId?: string | null;
  principalId?: string | null;
};

const maxMessageTitleLength = 48;
const profilePath = "/pages/profile/index";

function cleanText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function firstNonEmpty(values: Array<string | null | undefined>): string {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) {
      return cleaned;
    }
  }
  return "";
}

function truncateTitle(value: string): string {
  if (value.length <= maxMessageTitleLength) {
    return value;
  }
  return `${value.slice(0, maxMessageTitleLength - 3)}...`;
}

function sessionFrom(context: SessionContext): string {
  return Object.entries(context)
    .filter((entry): entry is [string, string] => Boolean(cleanText(entry[1] ?? "")))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(cleanText(value))}`)
    .join("&");
}

function contact(input: {
  context: SessionContext;
  title: string;
  path: string;
  image?: string | null;
  showMessageCard: boolean;
}): CustomerServiceContact {
  return {
    sessionFrom: sessionFrom(input.context),
    sendMessageTitle: truncateTitle(input.title),
    sendMessagePath: input.path,
    sendMessageImg: cleanText(input.image),
    showMessageCard: input.showMessageCard
  };
}

export function buildProfileCustomerServiceContact(input: { userId?: string | null }): CustomerServiceContact {
  return contact({
    context: {
      source: "profile",
      userId: input.userId
    },
    title: "平台客服",
    path: profilePath,
    showMessageCard: false
  });
}

export function buildAssetCustomerServiceContact(input: {
  userId?: string | null;
  asset: {
    id?: string | null;
    title?: string | null;
    principalId?: string | null;
    imageUrls?: Array<string | null | undefined>;
  };
}): CustomerServiceContact {
  const assetId = cleanText(input.asset.id);
  return contact({
    context: {
      source: "asset_detail",
      userId: input.userId,
      assetId,
      principalId: input.asset.principalId
    },
    title: `咨询：${cleanText(input.asset.title) || "交换宝贝"}`,
    path: assetId ? `/pages/auctions/detail?assetId=${encodeURIComponent(assetId)}` : profilePath,
    image: firstNonEmpty(input.asset.imageUrls ?? []),
    showMessageCard: true
  });
}

export function buildFollowupCustomerServiceContact(input: {
  userId?: string | null;
  followup: {
    id?: string | null;
    followupId?: string | null;
    assetId?: string | null;
    principalId?: string | null;
    assetTitle?: string | null;
    imageUrl?: string | null;
  };
}): CustomerServiceContact {
  const assetId = cleanText(input.followup.assetId);
  const followupId = cleanText(input.followup.followupId ?? input.followup.id);
  return contact({
    context: {
      source: "deal_followup",
      userId: input.userId,
      assetId,
      followupId,
      principalId: input.followup.principalId
    },
    title: `成交沟通：${cleanText(input.followup.assetTitle) || "交换宝贝"}`,
    path: assetId ? `/pages/profile/results?assetId=${encodeURIComponent(assetId)}` : profilePath,
    image: input.followup.imageUrl,
    showMessageCard: true
  });
}
