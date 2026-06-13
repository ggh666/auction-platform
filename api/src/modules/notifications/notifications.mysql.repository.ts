import type { NotificationItem, NotificationType } from "@auction/shared";
import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString } from "../../db/mysqlTypes";
import type { CreateNotificationInput, NotificationsRepository } from "./notifications.repository";

type NotificationDbRow = {
  id: number;
  user_id: number;
  type: NotificationType;
  asset_id: number;
  bid_id: number | null;
  actor_user_id: number | null;
  actor_display_name: string;
  asset_title: string;
  amount_cents: number | null;
  read_at: Date | string | null;
  created_at: Date | string;
};

const notificationSelect = `
  SELECT id, user_id, type, asset_id, bid_id, actor_user_id, actor_display_name, asset_title, amount_cents, read_at, created_at
  FROM station_notifications
`;

function toNotificationItem(row: NotificationDbRow): NotificationItem {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: row.type,
    assetId: String(row.asset_id),
    bidId: row.bid_id === null ? null : String(row.bid_id),
    actorUserId: row.actor_user_id === null ? null : String(row.actor_user_id),
    actorDisplayName: row.actor_display_name,
    assetTitle: row.asset_title,
    amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
    readAt: row.read_at === null ? null : toIsoString(row.read_at),
    createdAt: toIsoString(row.created_at)
  };
}

async function readNotification(db: MysqlExecutor, id: number): Promise<NotificationItem> {
  const [rows] = await db.execute<NotificationDbRow[]>(`${notificationSelect} WHERE id = ? LIMIT 1`, [id]);
  const row = firstRow<NotificationDbRow>(rows);
  if (!row) {
    throw new Error("Created notification could not be read");
  }
  return toNotificationItem(row);
}

export function createMysqlNotificationsRepository(db: MysqlExecutor): NotificationsRepository {
  async function listByUser(userId: string, limit = 50) {
    const [rows] = await db.execute<NotificationDbRow[]>(
      `${notificationSelect}
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [Number(userId), limit]
    );
    return allRows<NotificationDbRow>(rows).map(toNotificationItem);
  }

  return {
    async createMany(input: CreateNotificationInput[]) {
      const created: NotificationItem[] = [];
      for (const item of input) {
        const [result] = await db.execute<MysqlResultHeader>(
          `INSERT INTO station_notifications (
             user_id, type, asset_id, bid_id, actor_user_id, actor_display_name, asset_title, amount_cents
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(item.userId),
            item.type,
            Number(item.assetId),
            item.bidId === null || item.bidId === undefined ? null : Number(item.bidId),
            item.actorUserId === null || item.actorUserId === undefined ? null : Number(item.actorUserId),
            item.actorDisplayName,
            item.assetTitle,
            item.amountCents ?? null
          ]
        );
        created.push(await readNotification(db, result.insertId));
      }
      return created;
    },

    async listByUser(userId, limit = 50) {
      return listByUser(userId, limit);
    },

    async markRead(userId, notificationId) {
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE station_notifications
         SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE id = ? AND user_id = ?`,
        [Number(notificationId), Number(userId)]
      );
      if (result.affectedRows === 0) {
        return null;
      }

      return readNotification(db, Number(notificationId));
    },

    async markAllRead(userId) {
      await db.execute<MysqlResultHeader>(
        `UPDATE station_notifications
         SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE user_id = ? AND read_at IS NULL`,
        [Number(userId)]
      );

      return listByUser(userId);
    },

    async deleteByUserIds(userId, notificationIds) {
      if (notificationIds.length === 0) {
        return 0;
      }
      const placeholders = notificationIds.map(() => "?").join(",");
      const [result] = await db.execute<MysqlResultHeader>(
        `DELETE FROM station_notifications
         WHERE user_id = ? AND id IN (${placeholders})`,
        [Number(userId), ...notificationIds.map(Number)]
      );
      return result.affectedRows;
    },

    async deleteByBidId(bidId) {
      const [result] = await db.execute<MysqlResultHeader>(
        `DELETE FROM station_notifications
         WHERE bid_id = ?`,
        [Number(bidId)]
      );
      return result.affectedRows;
    }
  };
}
