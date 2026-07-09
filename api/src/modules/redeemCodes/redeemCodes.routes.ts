import type {
  RedeemCodeConfigResponse,
  RedeemCodeConfigUpdateRequest,
  RedeemCodeListResponse
} from "@auction/shared";
import { RedeemCodeParseError } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import { badRequest } from "../../http/errors";
import type { AdminRepository } from "../admin/admin.repository";
import type { RedeemCodeSettingsRepository } from "./redeemCodeSettings.repository";

const maxRawTextLength = 10000;

function readRawText(body: RedeemCodeConfigUpdateRequest | undefined): string {
  const rawText = typeof body?.rawText === "string" ? body.rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : "";
  if (rawText.length > maxRawTextLength) {
    throw badRequest("invalid_redeem_code_settings", "兑换码设置内容过长");
  }
  return rawText;
}

function parseErrorToBadRequest(error: unknown): never {
  if (error instanceof RedeemCodeParseError) {
    throw badRequest("invalid_redeem_code_settings", error.message);
  }
  throw error;
}

export function registerRedeemCodeRoutes(
  app: FastifyInstance,
  deps: {
    admins: AdminRepository;
    settings: RedeemCodeSettingsRepository;
  }
): void {
  app.get<{ Reply: RedeemCodeListResponse }>("/api/redeem-codes", async () => ({
    items: (await deps.settings.read()).items
  }));

  app.get<{ Reply: RedeemCodeConfigResponse }>(
    "/admin/redeem-codes/config",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async () => deps.settings.read()
  );

  app.put<{ Body: RedeemCodeConfigUpdateRequest; Reply: RedeemCodeConfigResponse }>(
    "/admin/redeem-codes/config",
    { preHandler: requireAdmin("asset:create", deps.admins) },
    async (request) => {
      if (!request.admin) {
        throw badRequest("invalid_redeem_code_settings", "Authentication required");
      }
      try {
        return await deps.settings.update(readRawText(request.body), request.admin.id);
      } catch (error) {
        parseErrorToBadRequest(error);
      }
    }
  );
}
