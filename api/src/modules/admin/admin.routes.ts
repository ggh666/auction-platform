import type {
  AdminAccountActionResponse,
  AdminAccountSummary,
  AdminAssetDetailResponse,
  AdminAssetListResponse,
  AdminUserActionResponse,
  AdminPrincipal,
  AdminRole,
  AuctionAsset,
  AssetStatus,
  UserSummary
} from "@auction/shared";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import { defaultAdminAssetStatuses, type AdminAssetListInput, type AssetsRepository } from "../assets/assets.repository";
import type { BidsRepository } from "../bids/bids.repository";
import type { ContentSafetyService } from "../contentSafety/contentSafety.service";
import type { DealFollowupsRepository } from "../dealFollowups/dealFollowups.repository";
import type { PrincipalRecord, PrincipalsRepository } from "../principals/principals.repository";
import { readUserSummary, toBidDisplayRecord } from "../users/userSummary";
import type { UsersRepository } from "../users/users.repository";
import { buildAdminAssetExcelWorkbook, type AdminAssetExportRow } from "./adminAssetExport";
import { emptyAdminAssetList, readAdminDataScope, type AdminDataScope } from "./adminPrincipalScope";
import { createAdminAuthService } from "./adminAuth.service";
import { hashAdminPassword } from "./adminPassword";
import type { AdminRepository, AdminUserRow } from "./admin.repository";
import { paginateItems, readPagination, type PageQuery } from "./pagination";

const assetStatuses: AssetStatus[] = ["draft", "pending_review", "active", "ended", "rejected", "cancelled", "removed"];
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

type AdminBatchAssetReviewAction = "approve" | "reject";
type AdminListQuery = PageQuery;
type AdminPrincipalBody = {
  adminId?: unknown;
  displayName?: unknown;
  disabled?: unknown;
};
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

function readReviewNote(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readCreditDeductionReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  return reason || "审核发现违规信息";
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

async function attachSellerSummaries(assets: AuctionAsset[], users: UsersRepository): Promise<AdminReviewAsset[]> {
  return Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      seller: await readUserSummary(users, asset.sellerId)
    }))
  );
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
  followups: DealFollowupsRepository
): void {
  const auth = createAdminAuthService(app, admins);

  app.post<{ Body: { username?: unknown; password?: unknown } }>("/admin/auth/login", async (request) => {
    return auth.login(request.body?.username, request.body?.password, request.ip);
  });

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
      items: await attachSellerSummaries(result.items, users)
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
      const recentBids = await bids.listByAsset(asset.id);
      const principal = asset.principalId ? await principals.findById(asset.principalId) : null;
      return {
        asset,
        seller: await readUserSummary(users, asset.sellerId),
        principal: principal ? { id: principal.id, displayName: principal.displayName } : null,
        recentBids: await Promise.all(recentBids.slice(-20).reverse().map((bid) => toBidDisplayRecord(users, bid)))
      };
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
      return {
        user: {
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
          createdAt: new Date(user.created_at).toISOString(),
          updatedAt: new Date(user.updated_at).toISOString()
        }
      };
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
      translateAssetActionError(error, "Only active assets with bids can be confirmed as sold");
    }

    let followup;
    try {
      const ensured = await followups.ensureForSoldAsset(asset);
      if (!ensured) {
        throw new Error("Deal followup could not be created");
      }
      followup = await followups.updateAdminStatus(ensured.id, "completed", "主理人确认已成交");
      if (!followup) {
        throw new Error("Deal followup could not be completed");
      }
    } catch (error) {
      await assets.save(original);
      throw error;
    }

    await admins.logOperation({
      adminId,
      action: "asset.confirm_deal",
      targetType: "asset",
      targetId: asset.id,
      detail: { followupId: followup.id, status: "completed" }
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
