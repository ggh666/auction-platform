import type {
  AdminAccountSummary,
  AdminImageSafetyCheck,
  AdminManagedUser,
  AdminPrincipal,
  AdminRole,
  AuctionAsset,
  AuctionResultStatus,
  BidDisplayRecord,
  DealFollowupStatus,
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
  profileRawData?: string;
  profileSignature?: string;
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

export type DealFollowupItem = {
  id: string;
  assetId: string;
  principalId: string | null;
  sellerId: string;
  buyerId: string;
  finalPriceCents: number;
  status: DealFollowupStatus;
  note: string | null;
  buyerConfirmedAt: string | null;
  buyerAbandonedAt: string | null;
  principalContactedAt: string | null;
  buyerUnreachableAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  asset: Pick<AuctionAsset, "id" | "title" | "gameName" | "serverName" | "assetType">;
  seller: UserSummary;
  buyer: UserSummary;
  principal: PrincipalSummary | null;
};

export type DealFollowupListResponse = {
  items: DealFollowupItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type DealFollowupActionResponse = {
  followup: DealFollowupItem;
};

export type AdminDealFollowupStatusRequest = {
  status: Extract<DealFollowupStatus, "principal_contacted" | "buyer_unreachable" | "completed" | "cancelled">;
  note?: string;
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
  imageSafetyChecks: AdminImageSafetyCheck[];
  recentBids: BidDisplayRecord[];
};

export type BidRestrictionDuration = "30m" | "1d" | "permanent";

export type AdminBidRestrictionRequest = {
  duration: BidRestrictionDuration;
  reason?: string;
};

export type AdminBidRevokeAndRestrictResponse = {
  asset: AuctionAsset;
  bid: BidDisplayRecord;
  user: AdminManagedUser;
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
  commitmentAccepted: boolean;
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

export type NotificationBulkActionResponse = NotificationListResponse;
