import type {
  AdminDealFollowupStatusRequest,
  DealFollowupActionResponse,
  DealFollowupItem,
  DealFollowupListResponse,
  DealFollowupStatus
} from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin, requireUser } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import type { AdminRepository } from "../admin/admin.repository";
import { readAdminDataScope } from "../admin/adminPrincipalScope";
import { readPagination, type PageQuery } from "../admin/pagination";
import type { AssetsRepository } from "../assets/assets.repository";
import type { PrincipalsRepository } from "../principals/principals.repository";
import { readUserSummary } from "../users/userSummary";
import type { UsersRepository } from "../users/users.repository";
import type { AdminDealFollowupStatus, DealFollowupRecord, DealFollowupsRepository } from "./dealFollowups.repository";

type DealFollowupQuery = PageQuery & {
  status?: unknown;
};

const adminStatuses: AdminDealFollowupStatus[] = ["principal_contacted", "buyer_unreachable", "completed", "cancelled"];
const buyerStatuses: Array<Extract<DealFollowupStatus, "buyer_confirmed" | "buyer_abandoned">> = [
  "buyer_confirmed",
  "buyer_abandoned"
];
const buyerTerminalStatuses: DealFollowupStatus[] = ["buyer_unreachable", "completed", "cancelled"];

function readStatusFilter(value: unknown): DealFollowupStatus | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const status = value.trim() as DealFollowupStatus;
  if (
    status === "pending_buyer_confirm" ||
    status === "buyer_confirmed" ||
    status === "buyer_abandoned" ||
    status === "principal_contacted" ||
    status === "buyer_unreachable" ||
    status === "completed" ||
    status === "cancelled"
  ) {
    return status;
  }
  throw badRequest("invalid_followup_status", "Deal followup status is invalid");
}

function readAdminStatusBody(body: AdminDealFollowupStatusRequest | undefined) {
  const status = body?.status;
  if (!adminStatuses.includes(status as AdminDealFollowupStatus)) {
    throw badRequest("invalid_followup_status", "Deal followup status is invalid");
  }
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (note.length > 500) {
    throw badRequest("invalid_followup_note", "Deal followup note must be 500 characters or fewer");
  }
  return { status: status as AdminDealFollowupStatus, note: note || null };
}

function readFollowupId(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw badRequest("invalid_followup", "Deal followup id is invalid");
  }
  return trimmed;
}

function assetSummary(followup: DealFollowupRecord, asset: Awaited<ReturnType<AssetsRepository["findById"]>>): DealFollowupItem["asset"] {
  return {
    id: followup.assetId,
    title: asset?.title ?? `资产 ${followup.assetId}`,
    gameName: asset?.gameName ?? "",
    serverName: asset?.serverName ?? "",
    assetType: asset?.assetType ?? ""
  };
}

async function toDealFollowupItem(
  followup: DealFollowupRecord,
  deps: {
    assets: AssetsRepository;
    users: UsersRepository;
    principals: PrincipalsRepository;
  }
): Promise<DealFollowupItem> {
  const [asset, seller, buyer, principal] = await Promise.all([
    deps.assets.findById(followup.assetId),
    readUserSummary(deps.users, followup.sellerId),
    readUserSummary(deps.users, followup.buyerId),
    followup.principalId ? deps.principals.findById(followup.principalId) : Promise.resolve(null)
  ]);

  return {
    ...followup,
    asset: assetSummary(followup, asset),
    seller,
    buyer,
    principal: principal ? { id: principal.id, displayName: principal.displayName } : null
  };
}

function withHasMore<T extends { page: number; pageSize: number; total: number }>(result: T) {
  return { ...result, hasMore: result.page * result.pageSize < result.total };
}

export function registerDealFollowupRoutes(
  app: FastifyInstance,
  deps: {
    admins: AdminRepository;
    assets: AssetsRepository;
    followups: DealFollowupsRepository;
    principals: PrincipalsRepository;
    users: UsersRepository;
  }
): void {
  async function syncBuyerFollowups(userId: string) {
    const candidates = await deps.assets.listSoldFollowupCandidates({ userId, limit: 200 });
    await deps.followups.ensureForSoldAssets(candidates);
  }

  async function syncAdminFollowups(principalId?: string) {
    const candidates = await deps.assets.listSoldFollowupCandidates({ principalId, limit: 200 });
    await deps.followups.ensureForSoldAssets(candidates);
  }

  app.get<{ Querystring: DealFollowupQuery; Reply: DealFollowupListResponse }>(
    "/api/profile/deal-followups",
    { preHandler: requireUser },
    async (request) => {
      await syncBuyerFollowups(request.user.id);
      const { page, pageSize } = readPagination(request.query);
      const result = await deps.followups.listForBuyer(request.user.id, {
        status: readStatusFilter(request.query.status),
        page,
        pageSize
      });
      return withHasMore({
        ...result,
        items: await Promise.all(result.items.map((followup) => toDealFollowupItem(followup, deps)))
      });
    }
  );

  async function updateBuyerFollowup(
    followupIdParam: string,
    userId: string,
    status: Extract<DealFollowupStatus, "buyer_confirmed" | "buyer_abandoned">
  ): Promise<DealFollowupActionResponse> {
    if (!buyerStatuses.includes(status)) {
      throw badRequest("invalid_followup_status", "Deal followup status is invalid");
    }
    const followupId = readFollowupId(followupIdParam);
    const existing = await deps.followups.findById(followupId);
    if (!existing || existing.buyerId !== userId) {
      throw new HttpError(404, "not_found", "Deal followup not found");
    }
    if (buyerTerminalStatuses.includes(existing.status)) {
      throw badRequest("invalid_followup_state", "Deal followup can no longer be updated by buyer");
    }
    const followup = await deps.followups.updateBuyerStatus(followupId, userId, status);
    if (!followup) {
      throw new HttpError(404, "not_found", "Deal followup not found");
    }
    return { followup: await toDealFollowupItem(followup, deps) };
  }

  app.post<{ Params: { followupId: string }; Reply: DealFollowupActionResponse }>(
    "/api/profile/deal-followups/:followupId/confirm",
    { preHandler: requireUser },
    async (request) => {
      return updateBuyerFollowup(request.params.followupId, request.user.id, "buyer_confirmed");
    }
  );

  app.post<{ Params: { followupId: string }; Reply: DealFollowupActionResponse }>(
    "/api/profile/deal-followups/:followupId/abandon",
    { preHandler: requireUser },
    async (request) => {
      return updateBuyerFollowup(request.params.followupId, request.user.id, "buyer_abandoned");
    }
  );

  app.get<{ Querystring: DealFollowupQuery; Reply: DealFollowupListResponse }>(
    "/admin/deal-followups",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async (request) => {
      const scope = await readAdminDataScope(request, deps.principals);
      const { page, pageSize } = readPagination(request.query);
      if (!scope) {
        return { items: [], total: 0, page, pageSize, hasMore: false };
      }
      await syncAdminFollowups(scope.principalId);
      const result = await deps.followups.listForAdmin({
        ...scope,
        status: readStatusFilter(request.query.status),
        page,
        pageSize
      });
      return withHasMore({
        ...result,
        items: await Promise.all(result.items.map((followup) => toDealFollowupItem(followup, deps)))
      });
    }
  );

  app.post<{ Params: { followupId: string }; Body: AdminDealFollowupStatusRequest; Reply: DealFollowupActionResponse }>(
    "/admin/deal-followups/:followupId/status",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      const followupId = readFollowupId(request.params.followupId);
      const body = readAdminStatusBody(request.body);
      const scope = await readAdminDataScope(request, deps.principals);
      const existing = await deps.followups.findById(followupId);
      if (!scope || !existing || (scope.principalId && existing.principalId !== scope.principalId)) {
        throw new HttpError(404, "not_found", "Deal followup not found");
      }

      const followup = await deps.followups.updateAdminStatus(followupId, body.status, body.note);
      if (!followup) {
        throw new HttpError(404, "not_found", "Deal followup not found");
      }
      if (body.status === "buyer_unreachable" && existing.status !== "buyer_unreachable") {
        await deps.users.recordBuyerUnreachable(Number(existing.buyerId));
      }
      await deps.admins.logOperation({
        adminId: request.admin.id,
        action: "deal_followup.update_status",
        targetType: "deal_followup",
        targetId: followup.id,
        detail: { status: body.status, note: body.note, assetId: followup.assetId, buyerId: followup.buyerId }
      });
      return { followup: await toDealFollowupItem(followup, deps) };
    }
  );
}
