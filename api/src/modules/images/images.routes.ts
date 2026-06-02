import type { FastifyInstance } from "fastify";
import { gone } from "../../http/errors";
import type { ImageStorage } from "./r2Storage";
import type { UsersRepository } from "../users/users.repository";
import type { ContentSafetyService } from "../contentSafety/contentSafety.service";

export function registerImageRoutes(
  app: FastifyInstance,
  _storage: ImageStorage,
  _users: UsersRepository,
  _contentSafety: ContentSafetyService
): void {
  app.post("/api/images", async () => {
    throw gone("user_image_upload_disabled", "Miniapp user image upload is disabled");
  });
}
