import type { DragonBallInfo, DragonBallPriceReferenceProfession, DragonBallProfession, DragonBallQuality } from "./dragonBall";

export type AssetStatus = "draft" | "pending_review" | "active" | "ended" | "rejected" | "cancelled" | "removed";
export type ExchangeResourceStatus = "pending_image_review" | "active" | "closed" | "removed" | "expired";
export type AssetResourceSource = "auction_asset" | "exchange_resource";
export type ReportStatus = "pending" | "rejected" | "confirmed";
export type AuctionResultStatus = "sold" | "unsold" | "cancelled" | "removed";
export type ImageSafetyStatus = "missing" | "pending" | "pass" | "review" | "risky" | "failed";
export type DealFollowupStatus =
  | "pending_buyer_confirm"
  | "buyer_confirmed"
  | "buyer_abandoned"
  | "principal_contacted"
  | "buyer_unreachable"
  | "completed"
  | "cancelled";
export type AdminRole = "super_admin" | "reviewer" | "operator";

export type UserSummary = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  banned: boolean;
  violationCount: number;
  creditScore: number;
  creditResetAt?: string | null;
  buyerUnreachableCount?: number;
  bidRestrictedUntil?: string | null;
  bidRestrictionPermanent?: boolean;
  bidRestrictionReason?: string | null;
  bidRestrictionStartedAt?: string | null;
};

export type AdminManagedUser = UserSummary & {
  banReason: string | null;
  dailyPublishLimit: number | null;
  creditResetAt: string | null;
  buyerUnreachableCount: number;
  bidRestrictedUntil: string | null;
  bidRestrictionPermanent: boolean;
  bidRestrictionReason: string | null;
  bidRestrictionStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAccountSummary = {
  id: string;
  username: string;
  role: AdminRole;
  disabledAt: string | null;
  principal?: {
    id: string;
    displayName: string;
    disabledAt: string | null;
  } | null;
};

export type SystemConfig = {
  key: string;
  value: string;
  updatedBy: number | null;
  updatedAt: string;
};

export type PrincipalSummary = {
  id: string;
  displayName: string;
};

export type AdminPrincipal = PrincipalSummary & {
  adminId: string;
  username: string;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuctionAsset = {
  id: string;
  sellerId: string;
  sellerGameId?: string | null;
  principalId: string | null;
  principal?: PrincipalSummary | null;
  gameName: string;
  serverName: string;
  assetType: string;
  itemCategory?: string | null;
  dragonBall?: DragonBallInfo | null;
  title: string;
  description: string;
  imageUrls: string[];
  status: AssetStatus;
  startingPriceCents: number;
  currentPriceCents: number | null;
  minIncrementCents: number;
  highestBidderId: string | null;
  originalEndAt: string;
  effectiveEndAt: string;
  createdAt: string;
  updatedAt: string;
  sellerViolationCount?: number;
  hasPublishedViolation?: boolean;
  followedByMe?: boolean;
};

export type ExchangeResource = {
  id: string;
  publisherId: string;
  publisher?: UserSummary;
  gameName: string;
  serverName: string;
  assetType: "道具";
  itemCategory: "龙珠";
  dragonBall: DragonBallInfo;
  dragonBallAmountCents: number | null;
  title: string;
  imageUrl: string;
  imageObjectKey: string;
  imageMimeType: string;
  imageSizeBytes: number;
  desiredExchange: string;
  description: string;
  status: ExchangeResourceStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DragonBallPriceReferenceItem = {
  id: string;
  batchId: string;
  profession: DragonBallPriceReferenceProfession;
  quality: DragonBallQuality;
  minPriceCents: number;
  maxPriceCents: number;
  createdAt: string;
  updatedAt: string;
};

export type DragonBallPriceReferenceBatch = {
  id: string;
  gameName: string;
  weekStartDate: string;
  weekEndDate: string;
  note: string;
  items: DragonBallPriceReferenceItem[];
  createdAt: string;
  updatedAt: string;
};

export type DragonBallPriceReferenceTrendItem = {
  batchId: string;
  gameName: string;
  weekStartDate: string;
  weekEndDate: string;
  profession: DragonBallPriceReferenceProfession;
  quality: DragonBallQuality;
  minPriceCents: number;
  maxPriceCents: number;
};

export type AdminImageSafetyCheck = {
  publicUrl: string;
  objectKey: string | null;
  status: ImageSafetyStatus;
  traceId: string | null;
  label: number | null;
  updatedAt: string | null;
};

export type BidRecord = {
  id: string;
  assetId: string;
  bidderId: string;
  amountCents: number;
  revokedAt?: string | null;
  revokedByAdminId?: string | null;
  revokeReason?: string | null;
  createdAt: string;
};

export type BidDisplayRecord = BidRecord & {
  bidder: UserSummary;
};

export type NotificationType = "outbid";

export type NotificationItem = {
  id: string;
  userId: string;
  type: NotificationType;
  assetId: string;
  bidId: string | null;
  actorUserId: string | null;
  actorDisplayName: string;
  assetTitle: string;
  amountCents: number | null;
  readAt: string | null;
  createdAt: string;
};

export type AssetConversationType = "principal_contact" | "seller_contact";
export type AssetMessageSenderType = "user" | "admin";

export type AssetConversation = {
  id: string;
  assetId: string;
  assetSource: AssetResourceSource;
  conversationType: AssetConversationType;
  userId: string;
  principalId: string | null;
  targetUserId: string | null;
  asset: Pick<AuctionAsset, "id" | "title" | "gameName" | "serverName" | "assetType">;
  user: UserSummary;
  principal: PrincipalSummary | null;
  targetUser: UserSummary | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageSenderType: AssetMessageSenderType | null;
  userUnreadCount: number;
  adminUnreadCount: number;
  userReadAt: string | null;
  adminReadAt: string | null;
  userDeletedAt: string | null;
  targetUserDeletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssetMessage = {
  id: string;
  conversationId: string;
  senderType: AssetMessageSenderType;
  senderUserId: string | null;
  senderAdminId: string | null;
  senderDisplayName: string;
  content: string;
  createdAt: string;
};
