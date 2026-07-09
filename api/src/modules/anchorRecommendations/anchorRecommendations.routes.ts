import type {
  AnchorRecommendationListResponse,
  AnchorRecommendationResponse,
  AnchorRecommendationUpsertRequest
} from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import { badRequest, notFound } from "../../http/errors";
import type { AdminRepository } from "../admin/admin.repository";
import type { AnchorRecommendationInput, AnchorRecommendationsRepository } from "./anchorRecommendations.repository";

const maxNameLength = 80;
const maxIntroLength = 500;
const maxImageUrlLength = 1000;

function readRequiredText(value: unknown, field: "name" | "intro" | "imageUrl", label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw badRequest("invalid_anchor_recommendation", `${label}不能为空`);
  }
  const text = value.trim();
  if (!text) {
    throw badRequest("invalid_anchor_recommendation", `${label}不能为空`);
  }
  if (text.length > maxLength) {
    throw badRequest("invalid_anchor_recommendation", `${label}过长`);
  }
  if (field === "imageUrl" && !/^https?:\/\/\S+$/i.test(text)) {
    throw badRequest("invalid_anchor_recommendation", "图片链接地址格式不正确");
  }
  return text;
}

function readAnchorInput(body: AnchorRecommendationUpsertRequest | undefined): AnchorRecommendationInput {
  return {
    name: readRequiredText(body?.name, "name", "主播名称", maxNameLength),
    intro: readRequiredText(body?.intro, "intro", "简介", maxIntroLength),
    imageUrl: readRequiredText(body?.imageUrl, "imageUrl", "图片链接地址", maxImageUrlLength)
  };
}

export function registerAnchorRecommendationRoutes(
  app: FastifyInstance,
  deps: {
    admins: AdminRepository;
    anchors: AnchorRecommendationsRepository;
  }
): void {
  app.get<{ Reply: AnchorRecommendationListResponse }>("/api/anchor-recommendations", async () => ({
    items: await deps.anchors.list()
  }));

  app.get<{ Reply: AnchorRecommendationListResponse }>(
    "/admin/anchor-recommendations",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async () => ({ items: await deps.anchors.list() })
  );

  app.post<{ Body: AnchorRecommendationUpsertRequest; Reply: AnchorRecommendationResponse }>(
    "/admin/anchor-recommendations",
    { preHandler: requireAdmin("asset:create", deps.admins) },
    async (request) => ({ anchor: await deps.anchors.create(readAnchorInput(request.body)) })
  );

  app.put<{ Params: { id: string }; Body: AnchorRecommendationUpsertRequest; Reply: AnchorRecommendationResponse }>(
    "/admin/anchor-recommendations/:id",
    { preHandler: requireAdmin("asset:create", deps.admins) },
    async (request) => {
      const anchor = await deps.anchors.update(request.params.id, readAnchorInput(request.body));
      if (!anchor) {
        throw notFound("anchor_recommendation_not_found", "Anchor recommendation not found");
      }
      return { anchor };
    }
  );

  app.delete<{ Params: { id: string }; Reply: { ok: true } }>(
    "/admin/anchor-recommendations/:id",
    { preHandler: requireAdmin("asset:create", deps.admins) },
    async (request) => {
      const deleted = await deps.anchors.delete(request.params.id);
      if (!deleted) {
        throw notFound("anchor_recommendation_not_found", "Anchor recommendation not found");
      }
      return { ok: true };
    }
  );
}
