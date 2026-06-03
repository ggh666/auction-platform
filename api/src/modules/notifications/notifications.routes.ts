import type { NotificationActionResponse, NotificationBulkActionResponse, NotificationListResponse } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireActiveUser, requireUser } from "../../http/auth";
import { notFound } from "../../http/errors";
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
}
