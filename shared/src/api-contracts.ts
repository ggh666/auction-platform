import type {
  AdminAccountSummary,
  AdminImageSafetyCheck,
  AdminManagedUser,
  AdminPrincipal,
  AdminRole,
  AnchorRecommendation,
  AssetConversation,
  AuctionAsset,
  AuctionResultStatus,
  AssetMessage,
  BidDisplayRecord,
  DealFollowupStatus,
  DragonBallPriceReferenceBatch,
  DragonBallPriceReferenceTrendItem,
  ExchangeResource,
  ImageSafetyStatus,
  NotificationItem,
  PrincipalSummary,
  SystemConfig,
  UserSummary
} from "./domain";
import type { RedeemCodeItem } from "./redeemCodes";
import type { SkyTowerFloorInfo, SkyTowerFloorOverride, SkyTowerRewardItem } from "./skyTower";

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

export type AssetPublishContextResponse = {
  enabled: boolean;
  disabledReason: string | null;
  principals: PrincipalSummary[];
  defaultMinIncrementCents: number;
  remainingDailyPublishCount: number;
  imagePolicy: {
    maxImagesPerAsset: number;
    maxImageSizeBytes: number;
    allowedMimeTypes: string[];
  };
};

export type AssetCreateResponse = {
  asset: AuctionAsset;
};

export type ExchangeResourceContextResponse = {
  enabled: boolean;
  disabledReason: string | null;
  gameName: string;
  supportedItemCategories: ["龙珠"];
};

export type ExchangeResourceCreateRequest = {
  gameName: string;
  serverName?: string;
  title: string;
  dragonBallAmountCents?: number | null;
  dragonBall: {
    profession: string;
    quality: string;
    attributes: string;
  };
  image: {
    objectKey: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
  };
  desiredExchange: string;
  description?: string;
};

export type ExchangeResourceListResponse = {
  items: ExchangeResource[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type ExchangeResourceResponse = {
  resource: ExchangeResource;
};

export type AnchorRecommendationListResponse = {
  items: AnchorRecommendation[];
};

export type AnchorRecommendationResponse = {
  anchor: AnchorRecommendation;
};

export type AnchorRecommendationUpsertRequest = {
  name: string;
  intro: string;
  imageUrl: string;
};

export type RedeemCodeListResponse = {
  items: RedeemCodeItem[];
};

export type RedeemCodeConfigResponse = {
  rawText: string;
  items: RedeemCodeItem[];
  updatedBy: number | null;
  updatedAt: string | null;
};

export type RedeemCodeConfigUpdateRequest = {
  rawText?: unknown;
};

export type SkyTowerListResponse = {
  floors: SkyTowerFloorInfo[];
  rewards: SkyTowerRewardItem[];
};

export type SkyTowerConfigResponse = SkyTowerListResponse & {
  rawText: string;
  items: SkyTowerFloorOverride[];
  updatedBy: number | null;
  updatedAt: string | null;
};

export type SkyTowerConfigUpdateRequest = {
  rawText?: unknown;
};

export type AppConfigResponse = {
  checkInUrl: string;
  dungeonMaterialImageUrl: string;
  dungeonGuideImageUrl: string;
  dungeonGuideImageUrls: string[];
};

export type DragonBallPriceReferenceItemInput = {
  profession: string;
  quality: string;
  minPriceCents: number;
  maxPriceCents: number;
};

export type DragonBallPriceReferenceBatchUpsertRequest = {
  gameName: string;
  weekStartDate: string;
  note?: string;
  items: DragonBallPriceReferenceItemInput[];
};

export type DragonBallPriceReferenceBatchResponse = {
  batch: DragonBallPriceReferenceBatch;
};

export type DragonBallPriceReferenceBatchListResponse = {
  items: DragonBallPriceReferenceBatch[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type DragonBallPriceReferenceLatestResponse = {
  batch: DragonBallPriceReferenceBatch | null;
};

export type DragonBallPriceReferenceTrendResponse = {
  items: DragonBallPriceReferenceTrendItem[];
};

export type UploadedImageResponse = {
  image: {
    objectKey: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    safetyStatus: ImageSafetyStatus;
    safetyTraceId: string | null;
  };
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

export type AdminAssetCopyDraftImage = {
  objectKey: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
};

export type AdminAssetCopyDraft = {
  sourceAssetId: string;
  principalId: string | null;
  gameName: string;
  sellerGameId: string;
  serverName: string;
  assetType: string;
  itemCategory: string | null;
  dragonBall: AuctionAsset["dragonBall"];
  title: string;
  description: string;
  startingPriceCents: number;
  minIncrementCents: number;
  images: AdminAssetCopyDraftImage[];
};

export type AdminAssetCopyDraftResponse = {
  draft: AdminAssetCopyDraft;
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
  principalContact: {
    enabled: boolean;
    reason: string | null;
  };
};

export type AssetConversationListResponse = {
  items: AssetConversation[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  unreadCount: number;
};

export type AssetConversationResponse = {
  conversation: AssetConversation;
};

export type AssetConversationMessagesResponse = {
  items: AssetMessage[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type AssetConversationMessageRequest = {
  content: string;
};

export type AssetConversationMessageResponse = {
  conversation: AssetConversation;
  message: AssetMessage;
};

export type AdminAssetConversationListResponse = AssetConversationListResponse;

export type BulkDeleteRequest = {
  ids: string[];
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

export type NotificationSummaryResponse = {
  unreadCount: number;
};

export type NotificationActionResponse = {
  notification: NotificationItem;
};

export type NotificationBulkActionResponse = NotificationListResponse;
