import type { SystemConfigActionResponse, SystemConfigListResponse } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import type { SystemConfigsRepository } from "../configs/configs.repository";
import type { AdminRepository } from "./admin.repository";
import { paginateItems, readPagination, type PageQuery } from "./pagination";

export function registerAdminConfigRoutes(
  app: FastifyInstance,
  admins: AdminRepository,
  configs: SystemConfigsRepository
): void {
  app.get<{ Querystring: PageQuery; Reply: SystemConfigListResponse }>(
    "/admin/configs",
    { preHandler: requireAdmin("config:manage", admins) },
    async (request) => {
      const { page, pageSize } = readPagination(request.query);
      return paginateItems(await configs.list(), page, pageSize);
    }
  );

  app.post<{ Params: { key: string }; Body: { value?: unknown }; Reply: SystemConfigActionResponse }>(
    "/admin/configs/:key",
    { preHandler: requireAdmin("config:manage", admins) },
    async (request) => {
      if (!request.admin) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }

      const value = typeof request.body?.value === "string" ? request.body.value.trim() : "";
      if (!value) {
        throw badRequest("invalid_config_value", "Config value is required");
      }
      if (value.length > 500) {
        throw badRequest("invalid_config_value", "Config value is too long");
      }

      try {
        return { config: await configs.update(request.params.key, value, request.admin.id) };
      } catch (error) {
        if (error instanceof Error && error.message === "Config not found") {
          throw new HttpError(404, "not_found", "Config not found");
        }
        throw error;
      }
    }
  );
}
