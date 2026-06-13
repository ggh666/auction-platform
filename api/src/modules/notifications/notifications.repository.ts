import type { NotificationItem, NotificationType } from "@auction/shared";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  assetId: string;
  bidId?: string | null;
  actorUserId?: string | null;
  actorDisplayName: string;
  assetTitle: string;
  amountCents?: number | null;
};

export type NotificationsRepository = {
  createMany(input: CreateNotificationInput[]): Promise<NotificationItem[]>;
  listByUser(userId: string, limit?: number): Promise<NotificationItem[]>;
  markRead(userId: string, notificationId: string): Promise<NotificationItem | null>;
  markAllRead(userId: string): Promise<NotificationItem[]>;
  deleteByUserIds(userId: string, notificationIds: string[]): Promise<number>;
  deleteByBidId(bidId: string): Promise<number>;
};

function cloneNotification(notification: NotificationItem): NotificationItem {
  return { ...notification };
}

export function createInMemoryNotificationsRepository(): NotificationsRepository {
  const notifications: NotificationItem[] = [];
  let nextId = 1;

  function listUserNotifications(userId: string, limit = 50): NotificationItem[] {
    return notifications
      .filter((notification) => notification.userId === userId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || Number(right.id) - Number(left.id))
      .slice(0, limit)
      .map(cloneNotification);
  }

  return {
    async createMany(input) {
      const createdAt = new Date().toISOString();
      const created = input.map((item) => ({
        id: String(nextId++),
        userId: item.userId,
        type: item.type,
        assetId: item.assetId,
        bidId: item.bidId ?? null,
        actorUserId: item.actorUserId ?? null,
        actorDisplayName: item.actorDisplayName,
        assetTitle: item.assetTitle,
        amountCents: item.amountCents ?? null,
        readAt: null,
        createdAt
      }));
      notifications.push(...created.map(cloneNotification));
      return created.map(cloneNotification);
    },

    async listByUser(userId, limit = 50) {
      return listUserNotifications(userId, limit);
    },

    async markRead(userId, notificationId) {
      const index = notifications.findIndex((notification) => notification.id === notificationId && notification.userId === userId);
      if (index === -1) {
        return null;
      }
      const readAt = notifications[index].readAt ?? new Date().toISOString();
      notifications[index] = { ...notifications[index], readAt };
      return cloneNotification(notifications[index]);
    },

    async markAllRead(userId) {
      const readAt = new Date().toISOString();
      for (const [index, notification] of notifications.entries()) {
        if (notification.userId === userId && notification.readAt === null) {
          notifications[index] = { ...notification, readAt };
        }
      }
      return listUserNotifications(userId);
    },

    async deleteByUserIds(userId, notificationIds) {
      const selected = new Set(notificationIds);
      let deleted = 0;
      for (let index = notifications.length - 1; index >= 0; index--) {
        if (notifications[index].userId === userId && selected.has(notifications[index].id)) {
          notifications.splice(index, 1);
          deleted++;
        }
      }
      return deleted;
    },

    async deleteByBidId(bidId) {
      let deleted = 0;
      for (let index = notifications.length - 1; index >= 0; index--) {
        if (notifications[index].bidId === bidId) {
          notifications.splice(index, 1);
          deleted++;
        }
      }
      return deleted;
    }
  };
}
