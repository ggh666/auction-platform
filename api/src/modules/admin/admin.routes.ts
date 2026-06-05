import type {
  AdminAccountActionResponse,
  AdminAccountSummary,
  AdminAssetCopyDraftResponse,
  AdminImageSafetyCheck,
  AdminAssetDetailResponse,
  AdminAssetListResponse,
  AdminBidRestrictionRequest,
  AdminBidRevokeAndRestrictResponse,
  AdminUserActionResponse,
  AdminPrincipal,
  AdminRole,
  AuctionAsset,
  AssetStatus,
  BidRestrictionDuration,
  UserSummary
} from "@auction/shared";
import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import { defaultAdminAssetStatuses, type AdminAssetListInput, type AssetsRepository } from "../assets/assets.repository";
import { createAssetsService } from "../assets/assets.service";
import type { BidsRepository } from "../bids/bids.repository";
import { assertLocalMarketplaceTextAllowed, type ContentSafetyService } from "../contentSafety/contentSafety.service";
import type { ImageSafetyRecord, ImageSafetyRepository } from "../contentSafety/imageSafety.repository";
import type { DealFollowupsRepository } from "../dealFollowups/dealFollowups.repository";
import { extensionForMimeType, uploadDirectoryForAssetType, validateImageUpload } from "../images/images.service";
import type { ImageStorage } from "../images/r2Storage";
import type { NotificationsRepository } from "../notifications/notifications.repository";
import type { PrincipalRecord, PrincipalsRepository } from "../principals/principals.repository";
import type { AuctionHub } from "../../realtime/auctionHub";
import { readUserSummary, toBidDisplayRecord } from "../users/userSummary";
import type { UserRow, UsersRepository } from "../users/users.repository";
import { buildAdminAssetExcelWorkbook, type AdminAssetExportRow } from "./adminAssetExport";
import { emptyAdminAssetList, readAdminDataScope, type AdminDataScope } from "./adminPrincipalScope";
import { createAdminAuthService } from "./adminAuth.service";
import { hashAdminPassword, verifyAdminPassword } from "./adminPassword";
import type { AdminRepository, AdminUserRow } from "./admin.repository";
import { paginateItems, readPagination, type PageQuery } from "./pagination";

const assetStatuses: AssetStatus[] = ["draft", "pending_review", "active", "ended", "rejected", "cancelled", "removed"];
const platformPublisherOpenid = "platform:asset-publisher";
const platformPublisherDisplayName = "平台代发";
const defaultAdminPublishDurationMs = 6 * 60 * 60 * 1000;
type AdminAssetQuery = {
  keyword?: unknown;
  status?: unknown;
  gameName?: unknown;
  assetType?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

type AdminBatchAssetReviewBody = {
  action?: unknown;
  assetIds?: unknown;
  note?: unknown;
};
type AdminBatchAssetRemoveBody = {
  assetIds?: unknown;
};
type AdminApproveAssetBody = {
  imageSafetyOverride?: unknown;
};
type AdminDeductCreditBody = {
  reason?: unknown;
};
type AdminChangePasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
  confirmNewPassword?: unknown;
};
type AdminPublishAssetBody = {
  principalId?: unknown;
  gameName?: unknown;
  sellerGameId?: unknown;
  serverName?: unknown;
  assetType?: unknown;
  itemCategory?: unknown;
  dragonBall?: unknown;
  title?: unknown;
  description?: unknown;
  startingPriceCents?: unknown;
  minIncrementCents?: unknown;
  endAt?: unknown;
  images?: unknown;
};
type AdminAssetEndTimeBody = {
  endAt?: unknown;
};

type AdminBatchAssetReviewAction = "approve" | "reject";
type AdminListQuery = PageQuery;
type AdminPrincipalBody = {
  adminId?: unknown;
  displayName?: unknown;
  disabled?: unknown;
};

const bidRestrictionDurations = new Set<BidRestrictionDuration>(["30m", "1d", "permanent"]);
const defaultBidRestrictionReason = "疑似故意抬价";
type AdminUserBody = {
  username?: unknown;
  password?: unknown;
  role?: unknown;
  disabled?: unknown;
};

type AdminBatchAssetReviewFailure = {
  assetId: string;
  code: string;
  message: string;
};

type AdminReviewAsset = AuctionAsset & {
  seller: UserSummary;
  imageSafetyChecks: AdminImageSafetyCheck[];
};

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberQuery(value: unknown, fallback: number): number {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function statusQuery(value: unknown): AssetStatus | undefined {
  const status = stringQuery(value);
  if (!status) {
    return undefined;
  }
  if (!assetStatuses.includes(status as AssetStatus)) {
    throw badRequest("invalid_asset_status", "Asset status filter is invalid");
  }
  return status as AssetStatus;
}

function readBatchAssetIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw badRequest("invalid_asset_batch", "assetIds must be a non-empty string array");
  }
  const ids = [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  if (ids.length === 0) {
    throw badRequest("invalid_asset_batch", "assetIds must be a non-empty string array");
  }
  return ids;
}

function readBatchAction(value: unknown): AdminBatchAssetReviewAction {
  if (value === "approve" || value === "reject") {
    return value;
  }
  throw badRequest("invalid_asset_batch_action", "Batch asset review action is invalid");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64Image(value: unknown): Buffer {
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest("invalid_image", "base64Data is required");
  }

  const buffer = Buffer.from(value, "base64");
  if (buffer.length === 0) {
    throw badRequest("invalid_image", "Image data is invalid");
  }
  return buffer;
}

function defaultAdminAssetEndAt(now = new Date()): string {
  return new Date(now.getTime() + defaultAdminPublishDurationMs).toISOString();
}

function readAdminAssetEndAt(value: unknown): string {
  const endAtIso = typeof value === "string" && value.trim() ? value.trim() : defaultAdminAssetEndAt();
  const endAt = new Date(endAtIso);
  if (!Number.isFinite(endAt.getTime()) || endAt.toISOString() !== endAtIso || endAt.getTime() <= Date.now()) {
    throw badRequest("invalid_asset_end_at", "Asset end time must be a valid future ISO time");
  }
  return endAtIso;
}

function readRequiredAdminAssetEndAt(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest("invalid_asset_end_at", "Asset end time is required");
  }
  return readAdminAssetEndAt(value);
}

function canUpdateAssetEndTime(asset: AuctionAsset): boolean {
  return asset.status === "active" || asset.status === "pending_review" || asset.status === "draft";
}

function readSellerGameId(value: unknown): string {
  const sellerGameId = typeof value === "string" ? value.trim() : "";
  if (!sellerGameId || sellerGameId.length > 80) {
    throw badRequest("invalid_seller_game_id", "Seller game id is required");
  }
  return sellerGameId;
}

function readDragonBallTextFields(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }
  return [value.profession, value.quality, value.attributes].filter((field): field is string => typeof field === "string");
}

function adminPublishText(body: AdminPublishAssetBody): string {
  return [
    body.gameName,
    body.sellerGameId,
    body.serverName,
    body.assetType,
    body.itemCategory,
    body.title,
    body.description,
    ...readDragonBallTextFields(body.dragonBall)
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function readReviewNote(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readCreditDeductionReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  return reason || "审核发现违规信息";
}

function readBidRestrictionReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  return reason || defaultBidRestrictionReason;
}

function readBidRestrictionDuration(value: unknown): BidRestrictionDuration {
  if (typeof value === "string" && bidRestrictionDurations.has(value as BidRestrictionDuration)) {
    return value as BidRestrictionDuration;
  }
  throw badRequest("invalid_bid_restriction_duration", "Bid restriction duration is invalid");
}

function bidRestrictionUntil(duration: BidRestrictionDuration, now = new Date()): Date | null {
  if (duration === "permanent") {
    return null;
  }
  const restrictedUntil = new Date(now);
  if (duration === "30m") {
    restrictedUntil.setMinutes(restrictedUntil.getMinutes() + 30);
    return restrictedUntil;
  }
  restrictedUntil.setDate(restrictedUntil.getDate() + 1);
  return restrictedUntil;
}

function readImageSafetyOverride(value: AdminApproveAssetBody | undefined): boolean {
  return value?.imageSafetyOverride === true;
}

function readAdminAssetFilters(query: AdminAssetQuery): Pick<
  AdminAssetListInput,
  "keyword" | "status" | "statuses" | "gameName" | "assetType"
> {
  const status = statusQuery(query.status);
  return {
    keyword: stringQuery(query.keyword),
    status,
    statuses: status ? undefined : defaultAdminAssetStatuses,
    gameName: stringQuery(query.gameName),
    assetType: stringQuery(query.assetType)
  };
}

function missingImageSafetyCheck(publicUrl: string): AdminImageSafetyCheck {
  return {
    publicUrl,
    objectKey: null,
    status: "missing",
    traceId: null,
    label: null,
    updatedAt: null
  };
}

function toAdminImageSafetyCheck(record: ImageSafetyRecord): AdminImageSafetyCheck {
  return {
    publicUrl: record.publicUrl,
    objectKey: record.objectKey,
    status: record.status,
    traceId: record.traceId,
    label: record.label,
    updatedAt: record.updatedAt
  };
}

async function attachImageSafetyChecks<T extends AuctionAsset>(
  assets: T[],
  imageSafety: ImageSafetyRepository
): Promise<Array<T & { imageSafetyChecks: AdminImageSafetyCheck[] }>> {
  const publicUrls = [...new Set(assets.flatMap((asset) => asset.imageUrls.map((imageUrl) => imageUrl.trim()).filter(Boolean)))];
  const records = await imageSafety.findByPublicUrls(publicUrls);
  const recordsByUrl = new Map(records.map((record) => [record.publicUrl, record]));

  return assets.map((asset) => ({
    ...asset,
    imageSafetyChecks: asset.imageUrls
      .map((imageUrl) => imageUrl.trim())
      .filter(Boolean)
      .map((publicUrl) => {
        const record = recordsByUrl.get(publicUrl);
        return record ? toAdminImageSafetyCheck(record) : missingImageSafetyCheck(publicUrl);
      })
  }));
}

async function attachSellerSummaries(
  assets: AuctionAsset[],
  users: UsersRepository,
  imageSafety: ImageSafetyRepository
): Promise<AdminReviewAsset[]> {
  const withSellers = await Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      seller: await readUserSummary(users, asset.sellerId)
    }))
  );
  return attachImageSafetyChecks(withSellers, imageSafety);
}

async function readAssetImageSafetyChecks(asset: AuctionAsset, imageSafety: ImageSafetyRepository): Promise<AdminImageSafetyCheck[]> {
  return (await attachImageSafetyChecks([asset], imageSafety))[0]?.imageSafetyChecks ?? [];
}

async function buildAssetCopyDraft(asset: AuctionAsset, assets: AssetsRepository): Promise<AdminAssetCopyDraftResponse> {
  return {
    draft: {
      sourceAssetId: asset.id,
      principalId: asset.principalId,
      gameName: asset.gameName,
      sellerGameId: asset.sellerGameId ?? "",
      serverName: asset.serverName,
      assetType: asset.assetType,
      itemCategory: asset.itemCategory ?? null,
      dragonBall: asset.dragonBall ? { ...asset.dragonBall } : null,
      title: asset.title,
      description: asset.description,
      startingPriceCents: asset.startingPriceCents,
      minIncrementCents: asset.minIncrementCents,
      images: await assets.listImagesByAssetId(asset.id)
    }
  };
}

function readPrincipalBody(value: AdminPrincipalBody | undefined) {
  const adminId = typeof value?.adminId === "string" || typeof value?.adminId === "number" ? String(value.adminId).trim() : "";
  const displayName = typeof value?.displayName === "string" ? value.displayName.trim() : "";
  if (!adminId || !/^\d+$/.test(adminId) || !displayName) {
    throw badRequest("invalid_principal", "adminId and displayName are required");
  }
  return {
    adminId,
    displayName,
    disabled: value?.disabled === true
  };
}

function readAdminRole(value: unknown): AdminRole {
  if (value === "super_admin" || value === "reviewer" || value === "operator") {
    return value;
  }
  throw badRequest("invalid_admin_role", "Admin role is invalid");
}

function readAdminUsername(value: unknown): string {
  const username = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) {
    throw badRequest("invalid_admin_username", "Admin username must be 3-64 letters, numbers, dots, underscores or hyphens");
  }
  return username;
}

function readAdminPassword(value: unknown, required: boolean): string | undefined {
  if (value === undefined && !required) {
    return undefined;
  }
  const password = typeof value === "string" ? value : "";
  if (password.length < 8 || password.length > 128) {
    throw badRequest("invalid_admin_password", "Admin password must be 8-128 characters");
  }
  return password;
}

function readAdminUserCreateBody(value: AdminUserBody | undefined) {
  return {
    username: readAdminUsername(value?.username),
    password: readAdminPassword(value?.password, true) as string,
    role: readAdminRole(value?.role)
  };
}

function readAdminUserUpdateBody(value: AdminUserBody | undefined) {
  const input: { username?: string; password?: string; role?: AdminRole; disabled?: boolean } = {};
  if (value?.username !== undefined) {
    input.username = readAdminUsername(value.username);
  }
  if (value?.password !== undefined) {
    input.password = readAdminPassword(value.password, false);
  }
  if (value?.role !== undefined) {
    input.role = readAdminRole(value.role);
  }
  if (value?.disabled !== undefined) {
    input.disabled = value.disabled === true;
  }
  if (
    input.username === undefined &&
    input.password === undefined &&
    input.role === undefined &&
    input.disabled === undefined
  ) {
    throw badRequest("invalid_admin_user", "Admin user update is empty");
  }
  return input;
}

function readAdminChangePasswordBody(value: AdminChangePasswordBody | undefined) {
  const currentPassword = typeof value?.currentPassword === "string" ? value.currentPassword : "";
  const newPassword = readAdminPassword(value?.newPassword, true) as string;
  const confirmNewPassword = typeof value?.confirmNewPassword === "string" ? value.confirmNewPassword : "";
  if (!currentPassword) {
    throw badRequest("invalid_current_password", "请输入当前密码");
  }
  if (newPassword !== confirmNewPassword) {
    throw badRequest("invalid_admin_password_confirmation", "两次输入的新密码不一致");
  }
  return { currentPassword, newPassword };
}

async function assertUsernameAvailable(admins: AdminRepository, username: string, currentAdminId?: number) {
  const existing = await admins.findByUsername(username);
  if (existing && existing.id !== currentAdminId) {
    throw badRequest("admin_username_exists", "Admin username already exists");
  }
}

async function assertAdminUserMutable(
  admins: AdminRepository,
  target: AdminUserRow,
  actorAdminId: number,
  input: { role?: AdminRole; disabled?: boolean }
) {
  if (target.id === actorAdminId && (input.disabled === true || (input.role !== undefined && input.role !== target.role))) {
    throw badRequest("invalid_admin_self_update", "Cannot disable or change role for current admin");
  }
  if (target.role !== "super_admin") {
    return;
  }
  const removingSuperPower = input.disabled === true || (input.role !== undefined && input.role !== "super_admin");
  if (!removingSuperPower) {
    return;
  }
  const activeSuperAdmins = (await admins.list()).filter(
    (admin) => admin.id !== target.id && admin.role === "super_admin" && admin.disabled_at === null
  );
  if (activeSuperAdmins.length === 0) {
    throw badRequest("last_super_admin", "At least one active super admin is required");
  }
}

async function toAdminPrincipal(admins: AdminRepository, principal: PrincipalRecord): Promise<AdminPrincipal> {
  const admin = await admins.findById(Number(principal.adminId));
  return {
    id: principal.id,
    adminId: principal.adminId,
    username: admin?.username ?? "",
    displayName: principal.displayName,
    disabledAt: principal.disabledAt,
    createdAt: principal.createdAt,
    updatedAt: principal.updatedAt
  };
}

function toAdminAccount(admin: AdminUserRow, principal: PrincipalRecord | null = null): AdminAccountSummary {
  return {
    id: String(admin.id),
    username: admin.username,
    role: admin.role,
    disabledAt: admin.disabled_at ? admin.disabled_at.toISOString() : null,
    principal: principal
      ? { id: principal.id, displayName: principal.displayName, disabledAt: principal.disabledAt }
      : null
  };
}

function toManagedUser(user: UserRow) {
  return {
    id: String(user.id),
    displayName: user.display_name,
    avatarUrl: user.avatar_url ?? undefined,
    banned: user.banned_at !== null,
    violationCount: user.violation_count,
    creditScore: user.credit_score,
    creditResetAt: user.credit_reset_at === null ? null : new Date(user.credit_reset_at).toISOString(),
    banReason: user.ban_reason,
    dailyPublishLimit: user.daily_publish_limit,
    buyerUnreachableCount: user.buyer_unreachable_count,
    bidRestrictedUntil: user.bid_restricted_until === null ? null : new Date(user.bid_restricted_until).toISOString(),
    bidRestrictionPermanent: user.bid_restricted_permanent,
    bidRestrictionReason: user.bid_restriction_reason,
    bidRestrictionStartedAt:
      user.bid_restriction_started_at === null ? null : new Date(user.bid_restriction_started_at).toISOString(),
    createdAt: new Date(user.created_at).toISOString(),
    updatedAt: new Date(user.updated_at).toISOString()
  };
}

async function readPrincipalByAdminId(principals: PrincipalsRepository, adminId: number): Promise<PrincipalRecord | null> {
  return (await principals.listForAdmin()).find((principal) => principal.adminId === String(adminId)) ?? null;
}

async function readPrincipalName(
  principals: PrincipalsRepository,
  principalNames: Map<string, string>,
  principalId: string | null
): Promise<string> {
  if (!principalId) {
    return "";
  }
  const cached = principalNames.get(principalId);
  if (cached !== undefined) {
    return cached;
  }
  const principal = await principals.findById(principalId);
  const displayName = principal?.displayName ?? "";
  principalNames.set(principalId, displayName);
  return displayName;
}

async function disablePrincipalForAdmin(principals: PrincipalsRepository, adminId: number) {
  const principal = await readPrincipalByAdminId(principals, adminId);
  if (!principal || principal.disabledAt !== null) {
    return;
  }
  await principals.upsert({ adminId: String(adminId), displayName: principal.displayName, disabled: true });
}

function readAdminIdParam(value: string): number {
  const adminId = Number(value);
  if (!Number.isInteger(adminId) || adminId <= 0) {
    throw badRequest("invalid_admin_user", "Admin user id is invalid");
  }
  return adminId;
}

function createTemporaryAdminPassword(): string {
  return `Tmp-${randomBytes(12).toString("base64url")}`;
}

function translateAssetActionError(error: unknown, invalidMessage: string): never {
  if (error instanceof HttpError) {
    throw error;
  }
  if (error instanceof Error && error.message === "Asset not found") {
    throw new HttpError(404, "not_found", "Asset not found");
  }
  if (error instanceof Error && error.message === "Invalid asset state") {
    throw badRequest("invalid_asset_state", invalidMessage);
  }
  throw error;
}

function toBatchFailure(assetId: string, error: unknown, invalidMessage: string): AdminBatchAssetReviewFailure {
  try {
    translateAssetActionError(error, invalidMessage);
  } catch (translated) {
    if (translated instanceof HttpError) {
      return { assetId, code: translated.code, message: translated.message };
    }
    if (translated instanceof Error) {
      return { assetId, code: "internal_error", message: translated.message };
    }
  }
  return { assetId, code: "internal_error", message: "Asset review failed" };
}

export function registerAdminRoutes(
  app: FastifyInstance,
  admins: AdminRepository,
  assets: AssetsRepository,
  bids: BidsRepository,
  users: UsersRepository,
  contentSafety: ContentSafetyService,
  principals: PrincipalsRepository,
  followups: DealFollowupsRepository,
  imageSafety: ImageSafetyRepository,
  imageStorage: ImageStorage,
  notifications: NotificationsRepository,
  hub: Pick<AuctionHub, "publish">
): void {
  const auth = createAdminAuthService(app, admins);
  const assetService = createAssetsService(assets);

  app.post<{ Body: { username?: unknown; password?: unknown } }>("/admin/auth/login", async (request) => {
    return auth.login(request.body?.username, request.body?.password, request.ip);
  });

  app.post<{ Body: AdminChangePasswordBody }>(
    "/admin/auth/change-password",
    { preHandler: requireAdmin("asset:view", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const body = readAdminChangePasswordBody(request.body);
      const admin = await admins.findById(request.admin.id);
      if (!admin || admin.disabled_at) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      if (!(await verifyAdminPassword(body.currentPassword, admin.password_hash))) {
        throw new HttpError(401, "invalid_current_password", "当前密码不正确");
      }

      const updated = await admins.update(admin.id, { passwordHash: await hashAdminPassword(body.newPassword) });
      await admins.logOperation({
        adminId: admin.id,
        action: "admin.password_change",
        targetType: "admin",
        targetId: String(admin.id),
        detail: { self: true }
      });

      return {
        admin: {
          id: String(updated.id),
          username: updated.username,
          role: updated.role
        }
      };
    }
  );

  app.get<{ Querystring: AdminListQuery }>("/admin/principals", { preHandler: requireAdmin("admin:manage", admins) }, async (request) => {
    const { page, pageSize } = readPagination(request.query);
    const items = await Promise.all((await principals.listForAdmin()).map((principal) => toAdminPrincipal(admins, principal)));
    return paginateItems(items, page, pageSize);
  });

  app.get<{ Querystring: AdminListQuery }>("/admin/admin-users", { preHandler: requireAdmin("admin:manage", admins) }, async (request) => {
    const { page, pageSize } = readPagination(request.query);
    const principalByAdminId = new Map((await principals.listForAdmin()).map((principal) => [principal.adminId, principal]));
    const items = (await admins.list()).map((admin) => toAdminAccount(admin, principalByAdminId.get(String(admin.id)) ?? null));
    return paginateItems(items, page, pageSize);
  });

  app.post<{ Body: AdminUserBody; Reply: AdminAccountActionResponse }>(
    "/admin/admin-users",
    { preHandler: requireAdmin("admin:manage", admins) },
    async (request) => {
      const body = readAdminUserCreateBody(request.body);
      await assertUsernameAvailable(admins, body.username);
      const admin = await admins.create({
        username: body.username,
        passwordHash: await hashAdminPassword(body.password),
        role: body.role
      });
      await admins.logOperation({
        adminId: request.admin?.id ?? 0,
        action: "admin_user.create",
        targetType: "admin_user",
        targetId: String(admin.id),
        detail: { username: admin.username, role: admin.role }
      });
      return { admin: toAdminAccount(admin) };
    }
  );

  async function updateAdminUser(
    adminIdParam: string,
    bodyValue: AdminUserBody | undefined,
    actorAdminId: number
  ): Promise<AdminAccountActionResponse> {
    const adminId = readAdminIdParam(adminIdParam);
    const existing = await admins.findById(adminId);
    if (!existing) {
      throw new HttpError(404, "not_found", "Admin user not found");
    }
    const body = readAdminUserUpdateBody(bodyValue);
    if (body.username !== undefined) {
      await assertUsernameAvailable(admins, body.username, adminId);
    }
    await assertAdminUserMutable(admins, existing, actorAdminId, body);
    const admin = await admins.update(adminId, {
      username: body.username,
      passwordHash: body.password === undefined ? undefined : await hashAdminPassword(body.password),
      role: body.role,
      disabled: body.disabled
    });
    if (body.disabled === true) {
      await disablePrincipalForAdmin(principals, admin.id);
    }
    await admins.logOperation({
      adminId: actorAdminId,
      action: "admin_user.update",
      targetType: "admin_user",
      targetId: String(admin.id),
      detail: { username: admin.username, role: admin.role, disabled: admin.disabled_at !== null }
    });
    return { admin: toAdminAccount(admin, await readPrincipalByAdminId(principals, admin.id)) };
  }

  app.patch<{ Params: { adminId: string }; Body: AdminUserBody; Reply: AdminAccountActionResponse }>(
    "/admin/admin-users/:adminId",
    { preHandler: requireAdmin("admin:manage", admins) },
    async (request) => {
      return updateAdminUser(request.params.adminId, request.body, request.admin?.id ?? 0);
    }
  );

  app.post<{ Params: { adminId: string }; Body: AdminUserBody; Reply: AdminAccountActionResponse }>(
    "/admin/admin-users/:adminId/update",
    { preHandler: requireAdmin("admin:manage", admins) },
    async (request) => {
      return updateAdminUser(request.params.adminId, request.body, request.admin?.id ?? 0);
    }
  );

  app.post<{ Params: { adminId: string }; Reply: AdminAccountActionResponse }>(
    "/admin/admin-users/:adminId/reset-password",
    { preHandler: requireAdmin("admin:manage", admins) },
    async (request) => {
      const adminId = readAdminIdParam(request.params.adminId);
      const existing = await admins.findById(adminId);
      if (!existing) {
        throw new HttpError(404, "not_found", "Admin user not found");
      }
      const temporaryPassword = createTemporaryAdminPassword();
      const admin = await admins.update(adminId, {
        passwordHash: await hashAdminPassword(temporaryPassword)
      });
      await admins.logOperation({
        adminId: request.admin?.id ?? 0,
        action: "admin_user.reset_password",
        targetType: "admin_user",
        targetId: String(admin.id),
        detail: { username: admin.username }
      });
      return { admin: toAdminAccount(admin, await readPrincipalByAdminId(principals, admin.id)), temporaryPassword };
    }
  );

  app.delete<{ Params: { adminId: string }; Reply: AdminAccountActionResponse }>(
    "/admin/admin-users/:adminId",
    { preHandler: requireAdmin("admin:manage", admins) },
    async (request) => {
      const adminId = Number(request.params.adminId);
      if (!Number.isInteger(adminId) || adminId <= 0) {
        throw badRequest("invalid_admin_user", "Admin user id is invalid");
      }
      const existing = await admins.findById(adminId);
      if (!existing) {
        throw new HttpError(404, "not_found", "Admin user not found");
      }
      await assertAdminUserMutable(admins, existing, request.admin?.id ?? 0, { disabled: true });
      const admin = await admins.softDelete(adminId);
      await disablePrincipalForAdmin(principals, admin.id);
      await admins.logOperation({
        adminId: request.admin?.id ?? 0,
        action: "admin_user.delete",
        targetType: "admin_user",
        targetId: String(admin.id),
        detail: { username: admin.username }
      });
      return { admin: toAdminAccount(admin, await readPrincipalByAdminId(principals, admin.id)) };
    }
  );

  app.post<{ Body: AdminPrincipalBody }>("/admin/principals", { preHandler: requireAdmin("admin:manage", admins) }, async (request) => {
    const body = readPrincipalBody(request.body);
    const admin = await admins.findById(Number(body.adminId));
    if (!admin || admin.disabled_at) {
      throw badRequest("invalid_principal_admin", "Principal admin user is invalid");
    }
    const principal = await principals.upsert(body);
    return { principal: await toAdminPrincipal(admins, principal) };
  });

  app.get<{ Querystring: AdminListQuery }>("/admin/assets/review", { preHandler: requireAdmin("asset:review", admins) }, async (request) => {
    const scope = await readAdminDataScope(request, principals);
    const { page, pageSize } = readPagination(request.query);
    if (!scope) {
      return emptyAdminAssetList(page, pageSize);
    }
    const result = await assets.listPendingReview({ ...scope, page, pageSize });
    return {
      ...result,
      items: await attachSellerSummaries(result.items, users, imageSafety)
    };
  });

  app.get<{ Querystring: AdminAssetQuery; Reply: AdminAssetListResponse }>(
    "/admin/assets",
    { preHandler: requireAdmin("asset:view", admins) },
    async (request) => {
      const scope = await readAdminDataScope(request, principals);
      const page = numberQuery(request.query.page, 1);
      const pageSize = Math.min(numberQuery(request.query.pageSize, 20), 100);
      if (!scope) {
        return emptyAdminAssetList(page, pageSize);
      }
      return assets.listForAdmin({
        ...readAdminAssetFilters(request.query),
        page,
        pageSize,
        ...scope
      });
    }
  );

  app.get("/admin/asset-publish-context", { preHandler: requireAdmin("asset:create", admins) }, async (request) => {
    const scope = await readAdminDataScope(request, principals);
    const principalItems = scope?.principalId
      ? [await principals.findActiveById(scope.principalId)].filter((principal): principal is PrincipalRecord => principal !== null)
      : scope
        ? await principals.listActive()
        : [];

    return {
      principals: principalItems.map((principal) => ({ id: principal.id, displayName: principal.displayName })),
      defaultEndAt: defaultAdminAssetEndAt()
    };
  });

  app.get<{ Params: { assetId: string }; Reply: AdminAssetCopyDraftResponse }>(
    "/admin/assets/:assetId/copy-draft",
    { preHandler: requireAdmin("asset:create", admins) },
    async (request) => {
      const scope = await readAdminDataScope(request, principals);
      if (!scope) {
        throw badRequest("invalid_asset_principal", "Active principal is required");
      }
      const asset = await assets.findById(request.params.assetId, scope);
      if (!asset) {
        throw new HttpError(404, "not_found", "Asset not found");
      }
      return buildAssetCopyDraft(asset, assets);
    }
  );

  app.post<{ Body: unknown }>("/admin/images", { preHandler: requireAdmin("asset:create", admins) }, async (request) => {
    if (!isRecord(request.body)) {
      throw badRequest("invalid_image", "Image payload is invalid");
    }

    const mimeType = request.body.mimeType;
    if (typeof mimeType !== "string") {
      throw badRequest("invalid_image", "mimeType is required");
    }
    const body = decodeBase64Image(request.body.base64Data);
    try {
      validateImageUpload({ mimeType, sizeBytes: body.length });
    } catch (error) {
      throw badRequest("invalid_image", error instanceof Error ? error.message : "Image payload is invalid");
    }

    const publisher = await users.findOrCreateWechatUser({
      openid: platformPublisherOpenid,
      displayName: platformPublisherDisplayName
    });
    let uploadDirectory: string;
    try {
      uploadDirectory = uploadDirectoryForAssetType(String(publisher.id), request.body.assetType);
    } catch (error) {
      throw badRequest("invalid_image_asset_type", error instanceof Error ? error.message : "Unsupported image asset type");
    }

    const objectKey = `${uploadDirectory}/${randomUUID()}.${extensionForMimeType(mimeType)}`;
    const stored = await imageStorage.putImage({ objectKey, body, mimeType });
    return {
      image: {
        objectKey: stored.objectKey,
        publicUrl: stored.publicUrl,
        mimeType,
        sizeBytes: body.length,
        safetyStatus: "pass",
        safetyTraceId: null
      }
    };
  });

  app.post<{ Body: AdminPublishAssetBody }>("/admin/assets", { preHandler: requireAdmin("asset:create", admins) }, async (request) => {
    if (!request.admin) {
      throw new HttpError(401, "unauthorized", "Authentication required");
    }
    if (!isRecord(request.body)) {
      throw badRequest("invalid_asset", "Asset payload is invalid");
    }

    const scope = await readAdminDataScope(request, principals);
    if (!scope) {
      throw badRequest("invalid_asset_principal", "Active principal is required");
    }
    const principalId =
      scope.principalId ??
      (typeof request.body.principalId === "string" && request.body.principalId.trim() ? request.body.principalId.trim() : "");
    const principal = principalId ? await principals.findActiveById(principalId) : null;
    if (!principal) {
      throw badRequest("invalid_asset_principal", "Active principal is required");
    }

    assertLocalMarketplaceTextAllowed(adminPublishText(request.body));
    const sellerGameId = readSellerGameId(request.body.sellerGameId);
    const publisher = await users.findOrCreateWechatUser({
      openid: platformPublisherOpenid,
      displayName: platformPublisherDisplayName
    });
    const endAt = readAdminAssetEndAt(request.body.endAt);
    const asset = await assetService.createActive({
      sellerId: String(publisher.id),
      sellerGameId,
      principalId: principal.id,
      gameName: request.body.gameName as string,
      serverName: request.body.serverName as string,
      assetType: request.body.assetType as string,
      itemCategory: request.body.itemCategory,
      dragonBall: request.body.dragonBall,
      title: request.body.title as string,
      description: request.body.description as string,
      startingPriceCents: request.body.startingPriceCents as number,
      minIncrementCents: request.body.minIncrementCents as number,
      endAt,
      images: request.body.images as Parameters<typeof assetService.createActive>[0]["images"]
    });
    await admins.logOperation({
      adminId: request.admin.id,
      action: "asset.create",
      targetType: "asset",
      targetId: asset.id,
      detail: { principalId: principal.id, sellerGameId, endAt }
    });
    return { asset };
  });

  app.post<{ Params: { assetId: string }; Body: AdminAssetEndTimeBody }>(
    "/admin/assets/:assetId/end-time",
    { preHandler: requireAdmin("asset:create", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      if (!isRecord(request.body)) {
        throw badRequest("invalid_asset_end_at", "Asset end time payload is invalid");
      }
      const scope = await readAdminDataScope(request, principals);
      if (!scope) {
        throw badRequest("invalid_asset_principal", "Active principal is required");
      }
      const endAt = readRequiredAdminAssetEndAt(request.body.endAt);
      return { asset: await updateAssetEndTime(request.params.assetId, request.admin.id, scope, endAt) };
    }
  );

  app.get<{ Querystring: AdminAssetQuery }>(
    "/admin/assets/export",
    { preHandler: requireAdmin("asset:view", admins) },
    async (request, reply) => {
      const scope = await readAdminDataScope(request, principals);
      const filters = readAdminAssetFilters(request.query);
      const rows: AdminAssetExportRow[] = [];

      if (scope) {
        const pageSize = 100;
        let page = 1;
        let total = 0;
        const principalNames = new Map<string, string>();

        do {
          const result = await assets.listForAdmin({ ...filters, ...scope, page, pageSize });
          total = result.total;
          for (const asset of result.items) {
            rows.push({
              asset,
              principalName: await readPrincipalName(principals, principalNames, asset.principalId)
            });
          }
          if (result.items.length === 0) {
            break;
          }
          page += 1;
        } while (rows.length < total);
      }

      const fileName = `asset-data-${new Date().toISOString().slice(0, 10)}.xls`;
      reply
        .header("content-type", "application/vnd.ms-excel; charset=utf-8")
        .header("content-disposition", `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      return reply.send(buildAdminAssetExcelWorkbook(rows));
    }
  );

  app.get<{ Params: { assetId: string }; Reply: AdminAssetDetailResponse }>(
    "/admin/assets/:assetId",
    { preHandler: requireAdmin("asset:view", admins) },
    async (request) => {
      const scope = await readAdminDataScope(request, principals);
      const asset = scope ? await assets.findById(request.params.assetId, scope) : null;
      if (!asset) {
        throw new HttpError(404, "not_found", "Asset not found");
      }
      const recentBids = await bids.listByAsset(asset.id, { includeRevoked: true });
      const principal = asset.principalId ? await principals.findById(asset.principalId) : null;
      return {
        asset,
        seller: await readUserSummary(users, asset.sellerId),
        principal: principal ? { id: principal.id, displayName: principal.displayName } : null,
        imageSafetyChecks: await readAssetImageSafetyChecks(asset, imageSafety),
        recentBids: await Promise.all(recentBids.slice(-20).reverse().map((bid) => toBidDisplayRecord(users, bid)))
      };
    }
  );

  app.post<{
    Params: { assetId: string; bidId: string };
    Body: AdminBidRestrictionRequest;
    Reply: AdminBidRevokeAndRestrictResponse;
  }>(
    "/admin/assets/:assetId/bids/:bidId/revoke-and-restrict",
    { preHandler: requireAdmin("asset:review", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const scope = await readAdminDataScope(request, principals);
      const asset = scope ? await assets.findById(request.params.assetId, scope) : null;
      if (!asset) {
        throw new HttpError(404, "not_found", "Asset not found");
      }

      const duration = readBidRestrictionDuration(request.body?.duration);
      const reason = readBidRestrictionReason(request.body?.reason);
      let revoked;
      try {
        revoked = await bids.revokeBidAndRecalculate({
          assetId: asset.id,
          bidId: request.params.bidId,
          adminId: request.admin.id,
          reason
        });
      } catch (error) {
        if (error instanceof Error && error.message === "Bid not found") {
          throw new HttpError(404, "not_found", "Bid not found");
        }
        if (error instanceof Error && error.message === "Bid already revoked") {
          throw badRequest("bid_already_revoked", "Bid already revoked");
        }
        throw error;
      }

      await notifications.deleteByBidId(revoked.bid.id);
      const restrictedUser = await users.restrictBidding(Number(revoked.bid.bidderId), {
        permanent: duration === "permanent",
        restrictedUntil: bidRestrictionUntil(duration),
        reason,
        adminId: request.admin.id
      });
      const displayBid = await toBidDisplayRecord(users, revoked.bid);
      const serverTime = new Date().toISOString();
      hub.publish(asset.id, {
        type: "bid_revoked",
        asset: revoked.asset,
        bid: displayBid,
        serverTime
      });
      await admins.logOperation({
        adminId: request.admin.id,
        action: "bid.revoke_and_restrict",
        targetType: "bid",
        targetId: revoked.bid.id,
        detail: {
          assetId: asset.id,
          bidderId: revoked.bid.bidderId,
          duration,
          reason,
          bidRestrictedUntil: restrictedUser.bid_restricted_until,
          permanent: restrictedUser.bid_restricted_permanent
        }
      });

      return {
        asset: revoked.asset,
        bid: displayBid,
        user: toManagedUser(restrictedUser)
      };
    }
  );

  app.post<{ Params: { assetId: string; userId: string }; Reply: AdminUserActionResponse }>(
    "/admin/assets/:assetId/bidders/:userId/bid-restriction/release",
    { preHandler: requireAdmin("asset:review", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const scope = await readAdminDataScope(request, principals);
      const asset = scope ? await assets.findById(request.params.assetId, scope) : null;
      if (!asset) {
        throw new HttpError(404, "not_found", "Asset not found");
      }
      const assetBids = await bids.listByAsset(asset.id, { includeRevoked: true });
      if (!assetBids.some((bid) => bid.bidderId === request.params.userId)) {
        throw new HttpError(404, "not_found", "Bidder not found for asset");
      }
      const userId = Number(request.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw badRequest("invalid_user", "Invalid user id");
      }
      const user = await users.releaseBidRestriction(userId);
      await admins.logOperation({
        adminId: request.admin.id,
        action: "user.release_bid_restriction",
        targetType: "user",
        targetId: String(user.id),
        detail: { assetId: asset.id }
      });
      return { user: toManagedUser(user) };
    }
  );

  app.post<{ Params: { assetId: string }; Body: AdminDeductCreditBody; Reply: AdminUserActionResponse }>(
    "/admin/assets/:assetId/deduct-credit",
    { preHandler: requireAdmin("asset:review", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const scope = await readAdminDataScope(request, principals);
      const asset = scope ? await assets.findById(request.params.assetId, scope) : null;
      if (!asset) {
        throw new HttpError(404, "not_found", "Asset not found");
      }
      const reason = readCreditDeductionReason(request.body?.reason);
      const user = await users.deductCreditScore(Number(asset.sellerId), 5);
      await admins.logOperation({
        adminId: request.admin.id,
        action: "user.credit_deduct",
        targetType: "user",
        targetId: asset.sellerId,
        detail: { assetId: asset.id, points: 5, reason, creditScore: user.credit_score }
      });
      return { user: toManagedUser(user) };
    }
  );

  async function approveAsset(
    assetId: string,
    adminId: number,
    scope: AdminDataScope,
    input: { imageSafetyOverride?: boolean } = {}
  ) {
    let asset;
    let usedImageSafetyOverride = false;
    try {
      const existing = await assets.findById(assetId, scope);
      if (!existing) {
        throw new Error("Asset not found");
      }
      try {
        await contentSafety.assertAssetImagesAllowed(assetId);
      } catch (error) {
        if (input.imageSafetyOverride && error instanceof HttpError && error.code === "image_safety_pending") {
          usedImageSafetyOverride = true;
        } else {
          throw error;
        }
      }
      asset = await assets.approvePending(assetId, scope);
    } catch (error) {
      translateAssetActionError(error, "Only pending review assets can be approved");
    }

    try {
      await admins.logOperation({
        adminId,
        action: "asset.approve",
        targetType: "asset",
        targetId: asset.id,
        detail: usedImageSafetyOverride ? { imageSafetyOverride: "pending" } : undefined
      });
    } catch (error) {
      await assets.save({ ...asset, status: "pending_review" });
      throw error;
    }
    return asset;
  }

  async function rejectAsset(assetId: string, adminId: number, note: string, scope: AdminDataScope) {
    let asset;
    try {
      asset = await assets.rejectPending(assetId, note, scope);
    } catch (error) {
      translateAssetActionError(error, "Only pending review assets can be rejected");
    }

    try {
      await admins.logOperation({
        adminId,
        action: "asset.reject",
        targetType: "asset",
        targetId: asset.id,
        detail: note ? { note } : undefined
      });
    } catch (error) {
      await assets.save({ ...asset, status: "pending_review" });
      throw error;
    }
    return asset;
  }

  async function updateAssetEndTime(assetId: string, adminId: number, scope: AdminDataScope, endAt: string) {
    const original = await assets.findById(assetId, scope);
    if (!original) {
      throw new HttpError(404, "not_found", "Asset not found");
    }
    if (!canUpdateAssetEndTime(original)) {
      throw badRequest("invalid_asset_state", "Only unfinished assets can update end time");
    }

    const asset = await assets.save({
      ...original,
      originalEndAt: endAt,
      effectiveEndAt: endAt
    });

    try {
      await admins.logOperation({
        adminId,
        action: "asset.end_time_update",
        targetType: "asset",
        targetId: asset.id,
        detail: {
          previousOriginalEndAt: original.originalEndAt,
          previousEffectiveEndAt: original.effectiveEndAt,
          endAt
        }
      });
    } catch (error) {
      await assets.save(original);
      throw error;
    }

    return asset;
  }

  async function removeAsset(assetId: string, adminId: number, scope: AdminDataScope) {
    let asset;
    try {
      asset = await assets.removeActive(assetId, scope);
    } catch (error) {
      translateAssetActionError(error, "Only active assets can be removed");
    }

    try {
      await admins.logOperation({
        adminId,
        action: "asset.remove",
        targetType: "asset",
        targetId: asset.id
      });
    } catch (error) {
      await assets.save({ ...asset, status: "active" });
      throw error;
    }
    return asset;
  }

  async function confirmDeal(assetId: string, adminId: number, scope: AdminDataScope) {
    const original = await assets.findById(assetId, scope);
    if (!original) {
      throw new HttpError(404, "not_found", "Asset not found");
    }
    let asset;
    try {
      asset = await assets.confirmActiveDeal(assetId, scope);
    } catch (error) {
      translateAssetActionError(error, "Only active assets with bids can be completed");
    }

    let followup: Awaited<ReturnType<DealFollowupsRepository["updateAdminStatus"]>> = null;
    let followupSyncError: string | null = null;
    try {
      const ensured = await followups.ensureForSoldAsset(asset);
      if (!ensured) {
        followupSyncError = "Deal followup could not be created";
      } else {
        followup = await followups.updateAdminStatus(ensured.id, "completed", "主理人完成交易");
        if (!followup) {
          followupSyncError = "Deal followup could not be completed";
        }
      }
    } catch (error) {
      followupSyncError = error instanceof Error ? error.message : "Deal followup sync failed";
      app.log.warn({ err: error, assetId: asset.id }, "Deal followup sync failed after asset completion");
    }

    await admins.logOperation({
      adminId,
      action: "asset.confirm_deal",
      targetType: "asset",
      targetId: asset.id,
      detail: {
        followupId: followup?.id ?? null,
        status: "completed",
        ...(followupSyncError ? { followupSyncError } : {})
      }
    });
    return asset;
  }

  app.post<{ Params: { assetId: string }; Body: AdminApproveAssetBody }>(
    "/admin/assets/:assetId/approve",
    { preHandler: requireAdmin("asset:review", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const scope = await readAdminDataScope(request, principals);
      if (!scope) {
        throw new HttpError(404, "not_found", "Asset not found");
      }
      return {
        asset: await approveAsset(request.params.assetId, request.admin.id, scope, {
          imageSafetyOverride: readImageSafetyOverride(request.body)
        })
      };
    }
  );

  app.post<{ Params: { assetId: string }; Body: { note?: unknown } }>(
    "/admin/assets/:assetId/reject",
    { preHandler: requireAdmin("asset:review", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const note = typeof request.body?.note === "string" ? request.body.note.trim() : "";
      const scope = await readAdminDataScope(request, principals);
      if (!scope) {
        throw new HttpError(404, "not_found", "Asset not found");
      }
      return { asset: await rejectAsset(request.params.assetId, request.admin.id, note, scope) };
    }
  );

  app.post<{ Body: AdminBatchAssetReviewBody }>(
    "/admin/assets/review/batch",
    { preHandler: requireAdmin("asset:review", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const action = readBatchAction(request.body?.action);
      const assetIds = readBatchAssetIds(request.body?.assetIds);
      const note = readReviewNote(request.body?.note);
      const scope = await readAdminDataScope(request, principals);
      const succeeded = [];
      const failed: AdminBatchAssetReviewFailure[] = [];

      for (const assetId of assetIds) {
        try {
          if (!scope) {
            throw new HttpError(404, "not_found", "Asset not found");
          }
          const asset =
            action === "approve"
              ? await approveAsset(assetId, request.admin.id, scope)
              : await rejectAsset(assetId, request.admin.id, note, scope);
          succeeded.push(asset);
        } catch (error) {
          failed.push(
            toBatchFailure(
              assetId,
              error,
              action === "approve"
                ? "Only pending review assets can be approved"
                : "Only pending review assets can be rejected"
            )
          );
        }
      }

      return { succeeded, failed };
    }
  );

  app.post<{ Body: AdminBatchAssetRemoveBody }>(
    "/admin/assets/remove/batch",
    { preHandler: requireAdmin("asset:remove", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const assetIds = readBatchAssetIds(request.body?.assetIds);
      const scope = await readAdminDataScope(request, principals);
      const succeeded = [];
      const failed: AdminBatchAssetReviewFailure[] = [];

      for (const assetId of assetIds) {
        try {
          if (!scope) {
            throw new HttpError(404, "not_found", "Asset not found");
          }
          const asset = await removeAsset(assetId, request.admin.id, scope);
          succeeded.push(asset);
        } catch (error) {
          failed.push(toBatchFailure(assetId, error, "Only active assets can be removed"));
        }
      }

      return { succeeded, failed };
    }
  );

  app.post<{ Params: { assetId: string } }>(
    "/admin/assets/:assetId/remove",
    { preHandler: requireAdmin("asset:remove", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const scope = await readAdminDataScope(request, principals);
      if (!scope) {
        throw new HttpError(404, "not_found", "Asset not found");
      }
      return { asset: await removeAsset(request.params.assetId, request.admin.id, scope) };
    }
  );

  app.post<{ Params: { assetId: string } }>(
    "/admin/assets/:assetId/confirm-deal",
    { preHandler: requireAdmin("auction:confirm_deal", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const scope = await readAdminDataScope(request, principals);
      if (!scope) {
        throw new HttpError(404, "not_found", "Asset not found");
      }
      return { asset: await confirmDeal(request.params.assetId, request.admin.id, scope) };
    }
  );
}
