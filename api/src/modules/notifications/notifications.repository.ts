import type { NotificationItem, NotificationType } from "@auction/shared";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  assetId: string;
  bidId: string;
  actorUserId: string;
  actorDisplayName: string;
  assetTitle: string;
  amountCents: number;
};

export type NotificationsRepository = {
  createMany(input: CreateNotificationInput[]): Promise<NotificationItem[]>;
  listByUser(userId: string, limit?: number): Promise<NotificationItem[]>;
  markRead(userId: string, notificationId: string): Promise<NotificationItem | null>;
};

function cloneNotification(notification: NotificationItem): NotificationItem {
  return { ...notification };
}

export function createInMemoryNotificationsRepository(): NotificationsRepository {
  const notifications: NotificationItem[] = [];
  let nextId = 1;

  return {
    async createMany(input) {
      const createdAt = new Date().toISOString();
      const created = input.map((item) => ({
        id: String(nextId++),
        userId: item.userId,
        type: item.type,
        assetId: item.assetId,
        bidId: item.bidId,
        actorUserId: item.actorUserId,
        actorDisplayName: item.actorDisplayName,
        assetTitle: item.assetTitle,
        amountCents: item.amountCents,
        readAt: null,
        createdAt
      }));
      notifications.push(...created.map(cloneNotification));
      return created.map(cloneNotification);
    },

    async listByUser(userId, limit = 50) {
      return notifications
        .filter((notification) => notification.userId === userId)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || Number(right.id) - Number(left.id))
        .slice(0, limit)
        .map(cloneNotification);
    },

    async markRead(userId, notificationId) {
      const index = notifications.findIndex((notification) => notification.id === notificationId && notification.userId === userId);
      if (index === -1) {
        return null;
      }
      const readAt = notifications[index].readAt ?? new Date().toISOString();
      notifications[index] = { ...notifications[index], readAt };
      return cloneNotification(notifications[index]);
    }
  };
}
