import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { UploadedImageResponse } from "@auction/shared";
import { requireActiveUser } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import type { SystemConfigsRepository } from "../configs/configs.repository";
import { readUserAssetPublishConfig } from "../configs/publishConfig";
import {
  extensionForMimeType,
  uploadDirectoryForAssetType,
  validateImageUpload
} from "./images.service";
import type { ImageStorage } from "./r2Storage";
import type { UsersRepository } from "../users/users.repository";
import type { ContentSafetyService } from "../contentSafety/contentSafety.service";

export function registerImageRoutes(
  app: FastifyInstance,
  storage: ImageStorage,
  users: UsersRepository,
  contentSafety: ContentSafetyService,
  configs: SystemConfigsRepository
): void {
  app.post<{ Body: unknown; Reply: UploadedImageResponse }>("/api/images", { preHandler: requireActiveUser(users) }, async (request) => {
    if (!request.user?.id) {
      throw new HttpError(401, "unauthorized", "Authentication required");
    }
    const user = await users.findById(Number(request.user.id));
    if (!user) {
      throw new HttpError(401, "unauthorized", "Authentication required");
    }
    const publishConfig = await readUserAssetPublishConfig(configs);
    if (!publishConfig.enabled) {
      throw new HttpError(403, "asset_publish_disabled", "User asset publishing is temporarily disabled");
    }
    if (typeof request.body !== "object" || request.body === null || Array.isArray(request.body)) {
      throw badRequest("invalid_image", "Image payload is invalid");
    }
    const body = request.body as Record<string, unknown>;
    const mimeType = body.mimeType;
    if (typeof mimeType !== "string") {
      throw badRequest("invalid_image", "mimeType is required");
    }
    const imageBody = decodeBase64Image(body.base64Data);
    try {
      validateImageUpload({ mimeType, sizeBytes: imageBody.length }, publishConfig.imagePolicy);
    } catch (error) {
      throw badRequest("invalid_image", error instanceof Error ? error.message : "Image payload is invalid");
    }

    let uploadDirectory: string;
    try {
      uploadDirectory = uploadDirectoryForAssetType(request.user.id, body.assetType);
    } catch (error) {
      throw badRequest("invalid_image_asset_type", error instanceof Error ? error.message : "Unsupported image asset type");
    }
    const objectKey = `${uploadDirectory}/${randomUUID()}.${extensionForMimeType(mimeType)}`;
    const stored = await storage.putImage({ objectKey, body: imageBody, mimeType });
    const safety = await contentSafety.requestImageCheck({
      userId: request.user.id,
      objectKey: stored.objectKey,
      mediaUrl: stored.publicUrl,
      openid: user.openid
    });

    return {
      image: {
        objectKey: stored.objectKey,
        publicUrl: stored.publicUrl,
        mimeType,
        sizeBytes: imageBody.length,
        safetyStatus: safety.status,
        safetyTraceId: safety.traceId ?? null
      }
    };
  });
}

function decodeBase64Image(value: unknown): Buffer {
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest("invalid_image", "base64Data is required");
  }
  const commaIndex = value.indexOf(",");
  const payload = commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
  try {
    return Buffer.from(payload, "base64");
  } catch {
    throw badRequest("invalid_image", "Image payload is invalid");
  }
}
