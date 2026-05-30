import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { firstRow, toMysqlDate } from "../../db/mysqlTypes";
import type { UserRow, UsersRepository } from "./users.repository";

type UserDbRow = {
  id: number;
  openid: string | null;
  display_name: string;
  avatar_url: string | null;
  banned_at: Date | string | null;
  ban_reason: string | null;
  violation_count: number;
  credit_score: number;
  credit_reset_at: Date | string | null;
  daily_publish_limit: number | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toUserRow(row: UserDbRow): UserRow {
  return {
    id: Number(row.id),
    openid: row.openid,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    banned_at: row.banned_at,
    ban_reason: row.ban_reason,
    violation_count: Number(row.violation_count),
    credit_score: Number(row.credit_score),
    credit_reset_at: row.credit_reset_at,
    daily_publish_limit: row.daily_publish_limit === null ? null : Number(row.daily_publish_limit),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

const userSelect = `
  SELECT
    id,
    openid,
    display_name,
    avatar_url,
    banned_at,
    ban_reason,
    violation_count,
    credit_score,
    credit_reset_at,
    daily_publish_limit,
    created_at,
    updated_at
  FROM users
`;

export function createMysqlUsersRepository(db: MysqlExecutor): UsersRepository {
  async function resetExpiredCreditScore(id: number): Promise<void> {
    await db.execute<MysqlResultHeader>(
      `UPDATE users
       SET credit_score = 100, credit_reset_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND credit_score < 100
         AND credit_reset_at IS NOT NULL
         AND credit_reset_at <= CURRENT_TIMESTAMP`,
      [id]
    );
  }

  async function findById(id: number): Promise<UserRow | null> {
    await resetExpiredCreditScore(id);
    const [rows] = await db.execute<UserDbRow[]>(`${userSelect} WHERE id = ? LIMIT 1`, [id]);
    const row = firstRow<UserDbRow>(rows);
    return row ? toUserRow(row) : null;
  }

  return {
    findById,

    async countAll() {
      const [rows] = await db.execute<Array<{ total: number | string }>>(`SELECT COUNT(*) AS total FROM users`);
      const row = firstRow<{ total: number | string }>(rows);
      return row ? Number(row.total) : 0;
    },

    async countBanned() {
      const [rows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM users
         WHERE banned_at IS NOT NULL`
      );
      const row = firstRow<{ total: number | string }>(rows);
      return row ? Number(row.total) : 0;
    },

    async countCreatedSince(since) {
      const [rows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM users
         WHERE created_at >= ?`,
        [toMysqlDate(since)]
      );
      const row = firstRow<{ total: number | string }>(rows);
      return row ? Number(row.total) : 0;
    },

    async listForAdmin(input = {}) {
      await db.execute<MysqlResultHeader>(
        `UPDATE users
         SET credit_score = 100, credit_reset_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE credit_score < 100
           AND credit_reset_at IS NOT NULL
           AND credit_reset_at <= CURRENT_TIMESTAMP`
      );
      const query = input.query?.trim() ?? "";
      const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
      const limit = Math.min(Math.max(input.limit ?? input.pageSize ?? 20, 1), 200);
      const offset = (page - 1) * limit;
      if (query) {
        const [rows] = await db.execute<UserDbRow[]>(
          `${userSelect}
           WHERE display_name LIKE ? OR CAST(id AS CHAR) = ?
           ORDER BY created_at DESC, id DESC
           LIMIT ? OFFSET ?`,
          [`%${query}%`, query, limit, offset]
        );
        return rows.map(toUserRow);
      }

      const [rows] = await db.execute<UserDbRow[]>(
        `${userSelect}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return rows.map(toUserRow);
    },

    async countForAdmin(input = {}) {
      await db.execute<MysqlResultHeader>(
        `UPDATE users
         SET credit_score = 100, credit_reset_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE credit_score < 100
           AND credit_reset_at IS NOT NULL
           AND credit_reset_at <= CURRENT_TIMESTAMP`
      );
      const query = input.query?.trim() ?? "";
      if (query) {
        const [rows] = await db.execute<Array<{ total: number | string }>>(
          `SELECT COUNT(*) AS total
           FROM users
           WHERE display_name LIKE ? OR CAST(id AS CHAR) = ?`,
          [`%${query}%`, query]
        );
        const row = firstRow<{ total: number | string }>(rows);
        return row ? Number(row.total) : 0;
      }
      return this.countAll();
    },

    async findOrCreateMockUser(displayName) {
      const [result] = await db.execute<MysqlResultHeader>(
        `INSERT INTO users (openid, display_name, avatar_url)
         VALUES (?, ?, ?)`,
        [null, displayName, null]
      );
      const user = await findById(result.insertId);
      if (!user) {
        throw new Error("Created user could not be read");
      }
      return user;
    },

    async findOrCreateWechatUser(input) {
      await db.execute<MysqlResultHeader>(
        `INSERT INTO users (openid, display_name, avatar_url)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           avatar_url = COALESCE(VALUES(avatar_url), avatar_url),
           updated_at = CURRENT_TIMESTAMP`,
        [input.openid, input.displayName, input.avatarUrl ?? null]
      );

      const [rows] = await db.execute<UserDbRow[]>(
        `${userSelect} WHERE openid = ? LIMIT 1`,
        [input.openid]
      );
      const row = firstRow<UserDbRow>(rows);
      if (!row) {
        throw new Error("WeChat user could not be read");
      }
      await resetExpiredCreditScore(Number(row.id));
      const [refreshedRows] = await db.execute<UserDbRow[]>(
        `${userSelect} WHERE openid = ? LIMIT 1`,
        [input.openid]
      );
      const refreshed = firstRow<UserDbRow>(refreshedRows);
      if (!refreshed) {
        throw new Error("WeChat user could not be read");
      }
      return toUserRow(refreshed);
    },

    async banUser(id, reason) {
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE users
         SET banned_at = CURRENT_TIMESTAMP, ban_reason = ?
         WHERE id = ?`,
        [reason.trim(), id]
      );
      if (result.affectedRows === 0) {
        throw new Error("User not found");
      }
      const user = await findById(id);
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    },

    async unbanUser(id) {
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE users
         SET banned_at = NULL, ban_reason = NULL
         WHERE id = ?`,
        [id]
      );
      if (result.affectedRows === 0) {
        throw new Error("User not found");
      }
      const user = await findById(id);
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    },

    async setDailyPublishLimit(id, limit) {
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE users
         SET daily_publish_limit = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [limit, id]
      );
      if (result.affectedRows === 0) {
        throw new Error("User not found");
      }
      const user = await findById(id);
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    },

    async deductCreditScore(id, points) {
      await resetExpiredCreditScore(id);
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE users
         SET
           violation_count = violation_count + 1,
           credit_score = GREATEST(0, credit_score - ?),
           credit_reset_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 3 MONTH),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [points, id]
      );
      if (result.affectedRows === 0) {
        throw new Error("User not found");
      }
      const user = await findById(id);
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    }
  };
}
