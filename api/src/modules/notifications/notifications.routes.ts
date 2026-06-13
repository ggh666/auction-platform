import type { BulkDeleteRequest, NotificationActionResponse, NotificationBulkActionResponse, NotificationListResponse } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireActiveUser, requireUser } from "../../http/auth";
import { badRequest, notFound } from "../../http/errors";
import type { UsersRepository } from "../users/users.repository";
import type { NotificationsRepository } from "./notifications.repository";

export function registerNotificationRoutes(app: FastifyInstance, notifications: NotificationsRepository, users: UsersRepository): void {
  app.get<{ Reply: NotificationListResponse }>("/api/profile/notifications", { preHandler: requireUser }, async (request) => {
    let items: NotificationListResponse["items"];
    try {
      items = await notifications.listByUser(request.user.id);
    } catch (error) {
      request.log.error({ err: error }, "failed to list profile notifications");
      return { items: [], unreadCount: 0 };
    }
    return { items, unreadCount: items.filter((notification) => notification.readAt === null).length };
  });

  app.post<{ Params: { notificationId: string }; Reply: NotificationActionResponse }>(
    "/api/profile/notifications/:notificationId/read",
    { preHandler: requireActiveUser(users) },
    async (request) => {
      const notification = await notifications.markRead(request.user.id, request.params.notificationId);
      if (!notification) {
        throw notFound("notification_not_found", "Notification not found");
      }
      return { notification };
    }
  );

  app.post<{ Reply: NotificationBulkActionResponse }>(
    "/api/profile/notifications/read-all",
    { preHandler: requireActiveUser(users) },
    async (request) => {
      const items = await notifications.markAllRead(request.user.id);
      return { items, unreadCount: items.filter((notification) => notification.readAt === null).length };
    }
  );

  app.post<{ Body: BulkDeleteRequest; Reply: NotificationBulkActionResponse }>(
    "/api/profile/notifications/delete",
    { preHandler: requireActiveUser(users) },
    async (request) => {
      const ids = readBulkDeleteIds(request.body);
      await notifications.deleteByUserIds(request.user.id, ids);
      const items = await notifications.listByUser(request.user.id);
      return { items, unreadCount: items.filter((notification) => notification.readAt === null).length };
    }
  );
}

function readBulkDeleteIds(body: BulkDeleteRequest | undefined): string[] {
  if (!body || !Array.isArray(body.ids)) {
    throw badRequest("invalid_delete_ids", "请选择要删除的记录");
  }
  const ids = [...new Set(body.ids.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean))];
  if (ids.length === 0 || ids.length > 100) {
    throw badRequest("invalid_delete_ids", "请选择 1 到 100 条记录");
  }
  return ids;
}
