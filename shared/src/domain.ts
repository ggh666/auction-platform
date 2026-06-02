import type { DragonBallInfo } from "./dragonBall";

export type AssetStatus = "draft" | "pending_review" | "active" | "ended" | "rejected" | "cancelled" | "removed";
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
};

export type AdminManagedUser = UserSummary & {
  banReason: string | null;
  dailyPublishLimit: number | null;
  creditResetAt: string | null;
  buyerUnreachableCount: number;
  bidRestrictedUntil: string | null;
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
  bidId: string;
  actorUserId: string;
  actorDisplayName: string;
  assetTitle: string;
  amountCents: number;
  readAt: string | null;
  createdAt: string;
};
