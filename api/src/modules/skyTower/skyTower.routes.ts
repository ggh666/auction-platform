import type {
  SkyTowerConfigResponse,
  SkyTowerConfigUpdateRequest,
  SkyTowerListResponse
} from "@auction/shared";
import { SkyTowerConfigParseError } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import { badRequest } from "../../http/errors";
import type { AdminRepository } from "../admin/admin.repository";
import type { SkyTowerSettingsRepository } from "./skyTowerSettings.repository";

const maxRawTextLength = 30000;

function readRawText(body: SkyTowerConfigUpdateRequest | undefined): string {
  const rawText = typeof body?.rawText === "string" ? body.rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : "";
  if (rawText.length > maxRawTextLength) {
    throw badRequest("invalid_sky_tower_settings", "天空塔设置内容过长");
  }
  return rawText;
}

function parseErrorToBadRequest(error: unknown): never {
  if (error instanceof SkyTowerConfigParseError) {
    throw badRequest("invalid_sky_tower_settings", error.message);
  }
  throw error;
}

export function registerSkyTowerRoutes(
  app: FastifyInstance,
  deps: {
    admins: AdminRepository;
    settings: SkyTowerSettingsRepository;
  }
): void {
  app.get<{ Reply: SkyTowerListResponse }>("/api/sky-tower", async () => {
    const config = await deps.settings.read();
    return {
      floors: config.floors,
      rewards: config.rewards
    };
  });

  app.get<{ Reply: SkyTowerConfigResponse }>(
    "/admin/sky-tower/config",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async () => deps.settings.read()
  );

  app.put<{ Body: SkyTowerConfigUpdateRequest; Reply: SkyTowerConfigResponse }>(
    "/admin/sky-tower/config",
    { preHandler: requireAdmin("asset:create", deps.admins) },
    async (request) => {
      if (!request.admin) {
        throw badRequest("invalid_sky_tower_settings", "Authentication required");
      }
      try {
        return await deps.settings.update(readRawText(request.body), request.admin.id);
      } catch (error) {
        parseErrorToBadRequest(error);
      }
    }
  );
}
