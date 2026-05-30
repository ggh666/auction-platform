import type {
  AdminAccountSummary,
  AdminManagedUser,
  AdminPrincipal,
  AdminRole,
  AuctionAsset,
  AuctionResultStatus,
  BidDisplayRecord,
  NotificationItem,
  PrincipalSummary,
  SystemConfig,
  UserSummary
} from "./domain";

export type ApiErrorResponse = {
  error: { code: string; message: string; details?: unknown };
};

export type LoginResponse = {
  token: string;
  user: UserSummary;
};

export type WechatLoginRequest = {
  code: string;
  displayName?: string;
  avatarUrl?: string;
};

export type AdminLoginResponse = {
  token: string;
  admin: { id: string; username: string; role: AdminRole };
};

export type AssetListResponse = {
  items: AuctionAsset[];
  nextCursor: string | null;
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
};

export type ProfileResultItem = {
  assetId: string;
  sellerId: string;
  buyerId: string | null;
  status: AuctionResultStatus;
  finalPriceCents: number | null;
  settledAt: string;
  asset: Pick<AuctionAsset, "id" | "title" | "gameName" | "serverName" | "assetType">;
};

export type ProfileResultsResponse = {
  items: ProfileResultItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type AdminAssetListResponse = {
  items: AuctionAsset[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminAssetDetailResponse = {
  asset: AuctionAsset;
  seller: UserSummary;
  principal: PrincipalSummary | null;
  recentBids: BidDisplayRecord[];
};

export type AdminDashboardMetrics = {
  pendingAssets: number;
  activeAssets: number;
  pendingReports: number;
  bannedUsers: number;
  totalUsers: number;
  todayNewUsers: number;
  todayPublishedAssets: number;
  todayBids: number;
};

export type AdminDashboardPendingReport = {
  id: string;
  reporterUserId: string;
  targetUserId: string;
  assetId: string | null;
  reason: string;
  createdAt: string;
};

export type AdminDashboardResponse = {
  metrics: AdminDashboardMetrics;
  pendingAssets: AuctionAsset[];
  pendingReports: AdminDashboardPendingReport[];
  generatedAt: string;
};

export type AdminUserListResponse = {
  items: AdminManagedUser[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUserActionResponse = {
  user: AdminManagedUser;
};

export type AdminAccountListResponse = {
  items: AdminAccountSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminAccountActionResponse = {
  admin: AdminAccountSummary;
  temporaryPassword?: string;
};

export type SystemConfigListResponse = {
  items: SystemConfig[];
  total: number;
  page: number;
  pageSize: number;
};

export type SystemConfigActionResponse = {
  config: SystemConfig;
};

export type PrincipalListResponse = {
  items: PrincipalSummary[];
};

export type AdminPrincipalListResponse = {
  items: AdminPrincipal[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminPrincipalActionResponse = {
  principal: AdminPrincipal;
};

export type AssetDetailResponse = {
  asset: AuctionAsset;
  seller: UserSummary;
  recentBids: BidDisplayRecord[];
};

export type PlaceBidRequest = {
  assetId: string;
  amountCents: number;
};

export type PlaceBidResponse = {
  bid: BidDisplayRecord;
  asset: AuctionAsset;
  extended: boolean;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  unreadCount: number;
};

export type NotificationActionResponse = {
  notification: NotificationItem;
};
