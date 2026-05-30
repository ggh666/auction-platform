import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireActiveUser } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import { extensionForMimeType, uploadDirectoryForAssetType, validateImageUpload } from "./images.service";
import type { ImageStorage } from "./r2Storage";
import type { UsersRepository } from "../users/users.repository";
import type { ContentSafetyService } from "../contentSafety/contentSafety.service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64Image(value: unknown): Buffer {
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest("invalid_image", "base64Data is required");
  }

  const buffer = Buffer.from(value, "base64");
  if (buffer.length === 0) {
    throw badRequest("invalid_image", "Image data is invalid");
  }
  return buffer;
}

export function registerImageRoutes(
  app: FastifyInstance,
  storage: ImageStorage,
  users: UsersRepository,
  contentSafety: ContentSafetyService
): void {
  app.post<{ Body: unknown }>("/api/images", { preHandler: requireActiveUser(users) }, async (request) => {
    if (!request.user?.id) {
      throw new HttpError(401, "unauthorized", "Authentication required");
    }
    if (!isRecord(request.body)) {
      throw badRequest("invalid_image", "Image payload is invalid");
    }

    const mimeType = request.body.mimeType;
    if (typeof mimeType !== "string") {
      throw badRequest("invalid_image", "mimeType is required");
    }
    const body = decodeBase64Image(request.body.base64Data);
    try {
      validateImageUpload({ mimeType, sizeBytes: body.length });
    } catch (error) {
      throw badRequest("invalid_image", error instanceof Error ? error.message : "Image payload is invalid");
    }

    let uploadDirectory: string;
    try {
      uploadDirectory = uploadDirectoryForAssetType(request.user.id, request.body.assetType);
    } catch (error) {
      throw badRequest("invalid_image_asset_type", error instanceof Error ? error.message : "Unsupported image asset type");
    }

    const objectKey = `${uploadDirectory}/${randomUUID()}.${extensionForMimeType(mimeType)}`;
    const stored = await storage.putImage({ objectKey, body, mimeType });
    const user = await users.findById(Number(request.user.id));
    const safety = await contentSafety.requestImageCheck({
      userId: request.user.id,
      objectKey: stored.objectKey,
      mediaUrl: stored.publicUrl,
      openid: user?.openid ?? null,
      scene: 3
    });
    return {
      image: {
        objectKey: stored.objectKey,
        publicUrl: stored.publicUrl,
        mimeType,
        sizeBytes: body.length,
        safetyStatus: safety.status,
        safetyTraceId: safety.traceId
      }
    };
  });
}
