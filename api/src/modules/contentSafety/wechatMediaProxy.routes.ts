import type { FastifyInstance } from "fastify";
import type { Env } from "../../config/env";
import { forbidden, notFound } from "../../http/errors";
import type { ImageStorage } from "../images/r2Storage";
import { verifyWechatMediaCheckToken } from "./wechatMediaProxy";

type WechatMediaProxyParams = {
  "*": string;
};

export function registerWechatMediaProxyRoutes(
  app: FastifyInstance,
  storage: ImageStorage,
  env: Pick<Env, "jwtSecret">
): void {
  app.get<{ Params: WechatMediaProxyParams }>("/api/wechat/media-check-image/*", async (request, reply) => {
    const verified = verifyWechatMediaCheckToken({
      token: request.params["*"],
      secret: env.jwtSecret
    });
    if (!verified) {
      throw forbidden("invalid_wechat_media_token", "Invalid WeChat media token");
    }

    const image = await storage.getImage(verified.objectKey);
    if (!image) {
      throw notFound("wechat_media_not_found", "Image not found");
    }

    return reply
      .header("cache-control", "public, max-age=86400")
      .header("content-type", image.mimeType)
      .header("content-length", String(image.body.length))
      .header("x-content-type-options", "nosniff")
      .send(image.body);
  });
}
