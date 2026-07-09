import type { AppConfigResponse, SystemConfigActionResponse, SystemConfigListResponse } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import type { SystemConfigsRepository } from "../configs/configs.repository";
import type { AdminRepository } from "./admin.repository";
import { paginateItems, readPagination, type PageQuery } from "./pagination";

const CHECK_IN_URL_KEY = "check_in_url";
const DUNGEON_MATERIAL_IMAGE_URL_KEY = "dungeon_material_image_url";
const DUNGEON_GUIDE_IMAGE_URL_KEY = "dungeon_guide_image_url";
const DEFAULT_CONFIG_VALUE_MAX_LENGTH = 500;
const LONG_CONFIG_VALUE_MAX_LENGTH = 5000;

function normalizeOptionalUrl(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed === "-" ? "" : trimmed;
}

function parseOptionalUrls(value: string | undefined): string[] {
  return normalizeOptionalUrl(value)
    .split(/[\r\n,，;；]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== "-");
}

function configValueMaxLength(key: string): number {
  return key === DUNGEON_GUIDE_IMAGE_URL_KEY ? LONG_CONFIG_VALUE_MAX_LENGTH : DEFAULT_CONFIG_VALUE_MAX_LENGTH;
}

export function registerAdminConfigRoutes(
  app: FastifyInstance,
  admins: AdminRepository,
  configs: SystemConfigsRepository
): void {
  app.get<{ Reply: AppConfigResponse }>("/api/app-config", async () => {
    const [checkInConfig, dungeonMaterialImageConfig, dungeonGuideImageConfig] = await Promise.all([
      configs.findByKey(CHECK_IN_URL_KEY),
      configs.findByKey(DUNGEON_MATERIAL_IMAGE_URL_KEY),
      configs.findByKey(DUNGEON_GUIDE_IMAGE_URL_KEY)
    ]);
    const dungeonGuideImageUrls = parseOptionalUrls(dungeonGuideImageConfig?.value);
    return {
      checkInUrl: normalizeOptionalUrl(checkInConfig?.value),
      dungeonMaterialImageUrl: normalizeOptionalUrl(dungeonMaterialImageConfig?.value),
      dungeonGuideImageUrl: dungeonGuideImageUrls[0] ?? "",
      dungeonGuideImageUrls
    };
  });

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
      if (value.length > configValueMaxLength(request.params.key)) {
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
