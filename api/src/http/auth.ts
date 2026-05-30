import type { FastifyReply, FastifyRequest } from "fastify";
import type { AdminRole } from "@auction/shared";
import { canAdmin, type AdminPermission } from "../modules/admin/adminPermissions";
import type { AdminRepository } from "../modules/admin/admin.repository";
import type { UsersRepository } from "../modules/users/users.repository";

export const MINIMUM_ACTIVE_CREDIT_SCORE_EXCLUSIVE = 70;

export type AuthenticatedUser = {
  id: string;
};

export type AuthenticatedAdmin = {
  id: number;
  role: AdminRole;
};

type UserJwtPayload = { userId: string; kind: "user" };
type AdminJwtPayload = { adminId: string; role: AdminRole; kind: "admin" };
type AuthJwtPayload = UserJwtPayload | AdminJwtPayload;

function isAdminRole(value: unknown): value is AdminRole {
  return value === "super_admin" || value === "reviewer" || value === "operator";
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<AuthJwtPayload>();
    if (payload.kind !== "user") {
      await reply.status(401).send({ error: { code: "unauthorized", message: "User token required" } });
      return;
    }
    request.user = { id: payload.userId };
  } catch {
    await reply.status(401).send({ error: { code: "unauthorized", message: "Authentication required" } });
  }
}

export async function readOptionalUserId(request: FastifyRequest): Promise<string | null> {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  if (!authorization.slice("bearer ".length).trim()) {
    return null;
  }

  try {
    const payload = await request.jwtVerify<AuthJwtPayload>();
    return payload.kind === "user" ? payload.userId : null;
  } catch {
    return null;
  }
}

export function requireActiveUser(users: UsersRepository) {
  return async function requireActiveUserPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireUser(request, reply);
    if (reply.sent) {
      return;
    }

    const userId = Number(request.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      await reply.status(401).send({ error: { code: "unauthorized", message: "Authentication required" } });
      return;
    }

    const user = await users.findById(userId);
    if (!user) {
      await reply.status(401).send({ error: { code: "unauthorized", message: "Authentication required" } });
      return;
    }

    if (user.banned_at !== null) {
      await reply.status(403).send({
        error: {
          code: "user_banned",
          message: "User is banned",
          details: { reason: user.ban_reason }
        }
      });
      return;
    }

    if (user.credit_score <= MINIMUM_ACTIVE_CREDIT_SCORE_EXCLUSIVE) {
      await reply.status(403).send({
        error: {
          code: "credit_score_too_low",
          message: "Credit score is too low for this action",
          details: {
            creditScore: user.credit_score,
            minimumExclusive: MINIMUM_ACTIVE_CREDIT_SCORE_EXCLUSIVE
          }
        }
      });
      return;
    }
  };
}

export function requireAdmin(permission: AdminPermission, admins: AdminRepository) {
  return async function requireAdminPermission(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const payload = await request.jwtVerify<AuthJwtPayload>();
      if (payload.kind !== "admin" || !isAdminRole(payload.role)) {
        await reply.status(401).send({ error: { code: "unauthorized", message: "Admin token required" } });
        return;
      }

      const adminId = Number(payload.adminId);
      if (!Number.isInteger(adminId) || adminId <= 0) {
        await reply.status(401).send({ error: { code: "unauthorized", message: "Admin token required" } });
        return;
      }

      const admin = await admins.findById(adminId);
      if (!admin || admin.disabled_at) {
        await reply.status(401).send({ error: { code: "unauthorized", message: "Admin token required" } });
        return;
      }

      if (!canAdmin(admin.role, permission)) {
        await reply.status(403).send({ error: { code: "forbidden", message: "Admin permission required" } });
        return;
      }

      request.admin = { id: admin.id, role: admin.role };
    } catch {
      await reply.status(401).send({ error: { code: "unauthorized", message: "Authentication required" } });
    }
  };
}

declare module "fastify" {
  interface FastifyRequest {
    admin?: AuthenticatedAdmin;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthJwtPayload;
    user: AuthenticatedUser;
  }
}
