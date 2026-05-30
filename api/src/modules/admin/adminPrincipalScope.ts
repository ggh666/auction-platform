import type { FastifyRequest } from "fastify";
import { HttpError } from "../../http/errors";
import type { PrincipalsRepository } from "../principals/principals.repository";

export type AdminDataScope = {
  principalId?: string;
};

export async function readAdminDataScope(
  request: FastifyRequest,
  principals: PrincipalsRepository
): Promise<AdminDataScope | null> {
  const admin = request.admin;
  if (!admin) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }
  if (admin.role === "super_admin") {
    return {};
  }

  const principal = await principals.findActiveByAdminId(admin.id);
  return principal ? { principalId: principal.id } : null;
}

export function emptyAdminAssetList(page = 1, pageSize = 20) {
  return { items: [], total: 0, page, pageSize };
}
