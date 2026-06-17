import type {
  AssetCreateResponse,
  AssetConversation,
  AssetConversationListResponse,
  AssetConversationMessageResponse,
  AssetConversationMessagesResponse,
  AssetConversationResponse,
  AssetDetailResponse,
  AssetListResponse,
  AssetPublishContextResponse,
  AuctionAsset,
  DragonBallPriceReferenceLatestResponse,
  DragonBallPriceReferenceTrendResponse,
  ExchangeResourceContextResponse,
  ExchangeResourceCreateRequest,
  ExchangeResourceListResponse,
  ExchangeResourceResponse,
  LoginResponse,
  NotificationActionResponse,
  NotificationBulkActionResponse,
  NotificationListResponse,
  PlaceBidRequest,
  PlaceBidResponse,
  PrincipalListResponse,
  ProfileResultsResponse,
  RedeemCodeListResponse,
  UploadedImageResponse,
  UserSummary,
  WechatLoginRequest
} from "@auction/shared";
import { readToken } from "../auth/session";

const API_BASE_STORAGE_KEY = "auction.api.base";
const DEFAULT_API_BASE = "https://api-auction.toolmatrix.top";

type RequestOptionsWithoutUrl = Omit<UniApp.RequestOptions, "url">;

type ImportMetaEnv = {
  UNI_APP_API_BASE?: string;
  VITE_API_BASE?: string;
};

function normalizeApiBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function readApiBase(): string {
  const stored = uni.getStorageSync(API_BASE_STORAGE_KEY);
  if (typeof stored === "string" && stored.trim()) {
    return normalizeApiBase(stored);
  }

  const env = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env;
  const configured = env?.UNI_APP_API_BASE ?? env?.VITE_API_BASE;
  if (configured?.trim()) {
    return normalizeApiBase(configured);
  }

  return DEFAULT_API_BASE;
}

function readErrorPayload(data: unknown): { message: string; details?: unknown } {
  if (typeof data === "object" && data !== null && "error" in data) {
    const error = (data as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string" && error.message.trim()) {
      return { message: error.message, details: (error as { details?: unknown }).details };
    }
  }

  if (typeof data === "object" && data !== null && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.includes("/api/auth/wechat-login")) {
      return { message: "后端微信登录接口未部署" };
    }
    if (typeof message === "string" && message.trim()) {
      return { message };
    }
  }

  return { message: "请求失败" };
}

export function request<T>(path: string, options: RequestOptionsWithoutUrl = {}): Promise<T> {
  const token = readToken();

  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      url: `${readApiBase()}${path}`,
      header: {
        "content-type": "application/json",
        authorization: token ? `Bearer ${token}` : "",
        ...(options.header ?? {})
      },
      success(response) {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
          return;
        }

        const errorPayload = readErrorPayload(response.data);
        reject(Object.assign(new Error(errorPayload.message), { details: errorPayload.details, statusCode: response.statusCode }));
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

export function mockLogin(displayName: string): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/mock-login", {
    method: "POST",
    data: { displayName }
  });
}

export function wechatLogin(input: WechatLoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/wechat-login", {
    method: "POST",
    data: input
  });
}

export function getProfile(): Promise<{ user: UserSummary }> {
  return request<{ user: UserSummary }>("/api/profile/me");
}

export type ProfileBidItem = {
  id: string;
  assetId: string;
  bidderId: string;
  amountCents: number;
  createdAt: string;
  asset: AuctionAsset;
};

export function listMyBids(): Promise<{ items: ProfileBidItem[] }> {
  return request<{ items: ProfileBidItem[] }>("/api/profile/bids");
}

export type ProfileResultItem = ProfileResultsResponse["items"][number];

export function listMyResults(query: Pick<AssetListQuery, "page" | "pageSize"> = {}): Promise<ProfileResultsResponse> {
  return request<ProfileResultsResponse>(`/api/profile/results${queryString(query)}`);
}

export function listMyAssets(query: Pick<AssetListQuery, "page" | "pageSize"> = {}): Promise<AssetListResponse> {
  return request<AssetListResponse>(`/api/profile/assets${queryString(query)}`);
}

export function listNotifications(): Promise<NotificationListResponse> {
  return request<NotificationListResponse>("/api/profile/notifications");
}

export function markNotificationRead(notificationId: string): Promise<NotificationActionResponse> {
  return request<NotificationActionResponse>(`/api/profile/notifications/${notificationId}/read`, {
    method: "POST"
  });
}

export function markAllNotificationsRead(): Promise<NotificationBulkActionResponse> {
  return request<NotificationBulkActionResponse>("/api/profile/notifications/read-all", {
    method: "POST"
  });
}

export function deleteNotifications(ids: string[]): Promise<NotificationBulkActionResponse> {
  return request<NotificationBulkActionResponse>("/api/profile/notifications/delete", {
    method: "POST",
    data: { ids }
  });
}

export type AssetConversationItem = AssetConversation;

export function createPrincipalConversation(assetId: string): Promise<AssetConversationResponse> {
  return request<AssetConversationResponse>(`/api/assets/${assetId}/conversations/principal`, {
    method: "POST"
  });
}

export function createSellerConversation(resourceId: string): Promise<AssetConversationResponse> {
  return request<AssetConversationResponse>(`/api/exchange-resources/${resourceId}/conversations/seller`, {
    method: "POST"
  });
}

export function listAssetConversations(query: Pick<AssetListQuery, "page" | "pageSize"> = {}): Promise<AssetConversationListResponse> {
  return request<AssetConversationListResponse>(`/api/profile/asset-conversations${queryString(query)}`);
}

export function deleteAssetConversations(ids: string[]): Promise<AssetConversationListResponse> {
  return request<AssetConversationListResponse>("/api/profile/asset-conversations/delete", {
    method: "POST",
    data: { ids }
  });
}

export function listAssetConversationMessages(
  conversationId: string,
  query: Pick<AssetListQuery, "page" | "pageSize"> = {}
): Promise<AssetConversationMessagesResponse> {
  return request<AssetConversationMessagesResponse>(
    `/api/profile/asset-conversations/${conversationId}/messages${queryString(query)}`
  );
}

export function sendAssetConversationMessage(conversationId: string, content: string): Promise<AssetConversationMessageResponse> {
  return request<AssetConversationMessageResponse>(`/api/profile/asset-conversations/${conversationId}/messages`, {
    method: "POST",
    data: { content }
  });
}

export function getExchangeResourceContext(gameName?: string): Promise<ExchangeResourceContextResponse> {
  return request<ExchangeResourceContextResponse>(`/api/exchange-resources/context${queryString({ gameName })}`);
}

export function listExchangeResources(query: Pick<AssetListQuery, "gameName" | "dragonBallProfession" | "dragonBallQuality" | "keyword" | "page" | "pageSize"> = {}): Promise<ExchangeResourceListResponse> {
  return request<ExchangeResourceListResponse>(`/api/exchange-resources${queryString(query)}`);
}

export function getExchangeResourceDetail(resourceId: string): Promise<ExchangeResourceResponse> {
  return request<ExchangeResourceResponse>(`/api/exchange-resources/${resourceId}`);
}

export function listRedeemCodes(): Promise<RedeemCodeListResponse> {
  return request<RedeemCodeListResponse>("/api/redeem-codes");
}

export function createExchangeResource(input: ExchangeResourceCreateRequest): Promise<ExchangeResourceResponse> {
  return request<ExchangeResourceResponse>("/api/exchange-resources", {
    method: "POST",
    data: input
  });
}

export function listMyExchangeResources(query: Pick<AssetListQuery, "page" | "pageSize"> = {}): Promise<ExchangeResourceListResponse> {
  return request<ExchangeResourceListResponse>(`/api/profile/exchange-resources${queryString(query)}`);
}

export function closeExchangeResource(resourceId: string): Promise<ExchangeResourceResponse> {
  return request<ExchangeResourceResponse>(`/api/profile/exchange-resources/${resourceId}/close`, {
    method: "POST"
  });
}

export function getDragonBallPriceReferenceLatest(gameName?: string): Promise<DragonBallPriceReferenceLatestResponse> {
  return request<DragonBallPriceReferenceLatestResponse>(`/api/dragon-ball-price-references/latest${queryString({ gameName })}`);
}

export function getDragonBallPriceReferenceTrend(query: {
  gameName?: string;
  profession: string;
  quality: string;
  limit?: number;
}): Promise<DragonBallPriceReferenceTrendResponse> {
  return request<DragonBallPriceReferenceTrendResponse>(`/api/dragon-ball-price-references/trend${queryString(query)}`);
}

export type AssetListQuery = {
  gameName?: string;
  assetType?: string;
  principalId?: string;
  dragonBallProfession?: string;
  dragonBallQuality?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  createdWithinDays?: number;
};

function queryString(input: Record<string, string | number | undefined>): string {
  const params = Object.entries(input)
    .filter((entry): entry is [string, string | number] => {
      const value = entry[1];
      return (typeof value === "string" && value.trim().length > 0) || typeof value === "number";
    })
    .map(([key, value]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(typeof value === "number" ? String(value) : value.trim())}`
    );
  return params.length > 0 ? `?${params.join("&")}` : "";
}

export function listAssets(query: AssetListQuery = {}): Promise<AssetListResponse> {
  return request<AssetListResponse>(`/api/assets${queryString(query)}`);
}

export function listPrincipals(): Promise<PrincipalListResponse> {
  return request<PrincipalListResponse>("/api/principals");
}

export function getAssetPublishContext(): Promise<AssetPublishContextResponse> {
  return request<AssetPublishContextResponse>("/api/asset-publish-context");
}

export type UploadedAssetImage = UploadedImageResponse["image"];

export function uploadAssetImage(input: {
  assetType: string;
  mimeType: UploadedAssetImage["mimeType"];
  base64Data: string;
  usage?: "asset" | "exchange_resource";
}): Promise<UploadedImageResponse> {
  return request<UploadedImageResponse>("/api/images", {
    method: "POST",
    data: input
  });
}

export type CreateAssetInput = {
  principalId: string;
  sellerGameId?: string;
  gameName: string;
  serverName: string;
  assetType: string;
  itemCategory?: string | null;
  dragonBall?: unknown;
  title: string;
  description: string;
  startingPriceCents: number;
  minIncrementCents: number;
  images: Array<Pick<UploadedAssetImage, "objectKey" | "publicUrl" | "mimeType" | "sizeBytes">>;
};

export function createAsset(input: CreateAssetInput): Promise<AssetCreateResponse> {
  return request<AssetCreateResponse>("/api/assets", {
    method: "POST",
    data: input
  });
}

export function listFollowedAssets(query: Pick<AssetListQuery, "page" | "pageSize"> = {}): Promise<AssetListResponse> {
  return request<AssetListResponse>(`/api/profile/follows${queryString(query)}`);
}

export function getAssetDetail(assetId: string): Promise<AssetDetailResponse> {
  return request<AssetDetailResponse>(`/api/assets/${assetId}`);
}

export function followAsset(assetId: string): Promise<{ assetId: string; followed: true }> {
  return request<{ assetId: string; followed: true }>(`/api/assets/${assetId}/follow`, {
    method: "POST"
  });
}

export function unfollowAsset(assetId: string): Promise<{ assetId: string; followed: false }> {
  return request<{ assetId: string; followed: false }>(`/api/assets/${assetId}/unfollow`, {
    method: "POST"
  });
}

export function placeBid(input: PlaceBidRequest): Promise<PlaceBidResponse> {
  return request<PlaceBidResponse>("/api/bids", {
    method: "POST",
    data: input
  });
}
