import type { AdminManagedUser, AdminUserActionResponse, AdminUserListResponse } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import type { UsersRepository, UserRow } from "../users/users.repository";
import type { AdminRepository } from "./admin.repository";
import { readPagination, type PageQuery } from "./pagination";

function toManagedUser(user: UserRow): AdminManagedUser {
  return {
    id: String(user.id),
    displayName: user.display_name,
    avatarUrl: user.avatar_url ?? undefined,
    banned: user.banned_at !== null,
    banReason: user.ban_reason,
    violationCount: user.violation_count,
    creditScore: user.credit_score,
    creditResetAt: user.credit_reset_at === null ? null : toIsoString(user.credit_reset_at),
    dailyPublishLimit: user.daily_publish_limit,
    buyerUnreachableCount: user.buyer_unreachable_count,
    bidRestrictedUntil: user.bid_restricted_until === null ? null : toIsoString(user.bid_restricted_until),
    bidRestrictionPermanent: user.bid_restricted_permanent,
    bidRestrictionReason: user.bid_restriction_reason,
    bidRestrictionStartedAt: user.bid_restriction_started_at === null ? null : toIsoString(user.bid_restriction_started_at),
    createdAt: toIsoString(user.created_at),
    updatedAt: toIsoString(user.updated_at)
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function logAdminOperation(
  admins: AdminRepository,
  adminId: number,
  action: string,
  targetId: string,
  detail?: unknown
) {
  await admins.logOperation({
    adminId,
    action,
    targetType: "user",
    targetId,
    detail
  });
}

function readPublishLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0 || limit > 999) {
    throw badRequest("invalid_publish_limit", "Daily publish limit must be an integer between 0 and 999");
  }
  return limit;
}

export function registerAdminUserRoutes(app: FastifyInstance, admins: AdminRepository, users: UsersRepository): void {
  app.get<{ Querystring: { q?: string } & PageQuery; Reply: AdminUserListResponse }>(
    "/admin/users",
    { preHandler: requireAdmin("user:view", admins) },
    async (request) => {
      const query = typeof request.query.q === "string" ? request.query.q : "";
      const { page, pageSize } = readPagination(request.query);
      const [items, total] = await Promise.all([
        users.listForAdmin({ query, page, pageSize }),
        users.countForAdmin({ query })
      ]);
      return { items: items.map(toManagedUser), total, page, pageSize };
    }
  );

  app.post<{ Params: { userId: string }; Body: { limit?: unknown }; Reply: AdminUserActionResponse }>(
    "/admin/users/:userId/publish-limit",
    { preHandler: requireAdmin("user:ban", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const userId = Number(request.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw badRequest("invalid_user", "Invalid user id");
      }

      const limit = readPublishLimit(request.body?.limit);
      try {
        const user = await users.setDailyPublishLimit(userId, limit);
        await logAdminOperation(admins, request.admin.id, "user.set_publish_limit", String(user.id), { limit });
        return { user: toManagedUser(user) };
      } catch (error) {
        if (error instanceof Error && error.message === "User not found") {
          throw new HttpError(404, "not_found", "User not found");
        }
        throw error;
      }
    }
  );

  app.post<{ Params: { userId: string }; Reply: AdminUserActionResponse }>(
    "/admin/users/:userId/bid-restriction/release",
    { preHandler: requireAdmin("user:ban", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const userId = Number(request.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw badRequest("invalid_user", "Invalid user id");
      }

      try {
        const user = await users.releaseBidRestriction(userId);
        await logAdminOperation(admins, request.admin.id, "user.release_bid_restriction", String(user.id));
        return { user: toManagedUser(user) };
      } catch (error) {
        if (error instanceof Error && error.message === "User not found") {
          throw new HttpError(404, "not_found", "User not found");
        }
        throw error;
      }
    }
  );

  app.post<{ Params: { userId: string }; Body: { reason?: unknown }; Reply: AdminUserActionResponse }>(
    "/admin/users/:userId/ban",
    { preHandler: requireAdmin("user:ban", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const userId = Number(request.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw badRequest("invalid_user", "Invalid user id");
      }

      const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : "";
      if (!reason) {
        throw badRequest("invalid_ban_reason", "Ban reason is required");
      }

      try {
        const user = await users.banUser(userId, reason);
        await logAdminOperation(admins, request.admin.id, "user.ban", String(user.id), { reason });
        return { user: toManagedUser(user) };
      } catch (error) {
        if (error instanceof Error && error.message === "User not found") {
          throw new HttpError(404, "not_found", "User not found");
        }
        throw error;
      }
    }
  );

  app.post<{ Params: { userId: string }; Reply: AdminUserActionResponse }>(
    "/admin/users/:userId/unban",
    { preHandler: requireAdmin("user:ban", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const userId = Number(request.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw badRequest("invalid_user", "Invalid user id");
      }

      try {
        const user = await users.unbanUser(userId);
        await logAdminOperation(admins, request.admin.id, "user.unban", String(user.id));
        return { user: toManagedUser(user) };
      } catch (error) {
        if (error instanceof Error && error.message === "User not found") {
          throw new HttpError(404, "not_found", "User not found");
        }
        throw error;
      }
    }
  );
}
