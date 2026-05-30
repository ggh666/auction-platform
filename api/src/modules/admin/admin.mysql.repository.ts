import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow } from "../../db/mysqlTypes";
import type { AdminOperationLog, AdminRepository, AdminUserRow } from "./admin.repository";

type AdminDbRow = {
  id: number;
  username: string;
  password_hash: string;
  role: AdminUserRow["role"];
  disabled_at: Date | null;
};

function toAdminRow(row: AdminDbRow): AdminUserRow {
  return {
    id: Number(row.id),
    username: row.username,
    password_hash: row.password_hash,
    role: row.role,
    disabled_at: row.disabled_at
  };
}

export function createMysqlAdminRepository(db: MysqlExecutor): AdminRepository {
  async function readById(id: number): Promise<AdminUserRow | null> {
    const [rows] = await db.execute<AdminDbRow[]>(
      `SELECT id, username, password_hash, role, disabled_at
       FROM admin_users
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    const row = firstRow<AdminDbRow>(rows);
    return row ? toAdminRow(row) : null;
  }

  return {
    async findById(id) {
      return readById(id);
    },

    async findByUsername(username) {
      const [rows] = await db.execute<AdminDbRow[]>(
        `SELECT id, username, password_hash, role, disabled_at
         FROM admin_users
         WHERE username = ?
         LIMIT 1`,
        [username]
      );
      const row = firstRow<AdminDbRow>(rows);
      return row ? toAdminRow(row) : null;
    },

    async list() {
      const [rows] = await db.execute<AdminDbRow[]>(
        `SELECT id, username, password_hash, role, disabled_at
         FROM admin_users
         ORDER BY id ASC`
      );
      return allRows<AdminDbRow>(rows).map(toAdminRow);
    },

    async create(input) {
      const [result] = await db.execute<MysqlResultHeader>(
        `INSERT INTO admin_users (username, password_hash, role)
         VALUES (?, ?, ?)`,
        [input.username, input.passwordHash, input.role]
      );
      const created = await readById(result.insertId);
      if (!created) {
        throw new Error("Admin user could not be read");
      }
      return created;
    },

    async update(id, input) {
      const existing = await readById(id);
      if (!existing) {
        throw new Error("Admin user not found");
      }
      await db.execute<MysqlResultHeader>(
        `UPDATE admin_users
         SET username = ?, password_hash = ?, role = ?, disabled_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          input.username ?? existing.username,
          input.passwordHash ?? existing.password_hash,
          input.role ?? existing.role,
          input.disabled === undefined ? existing.disabled_at : input.disabled ? existing.disabled_at ?? new Date() : null,
          id
        ]
      );
      const updated = await readById(id);
      if (!updated) {
        throw new Error("Admin user could not be read");
      }
      return updated;
    },

    async softDelete(id) {
      const existing = await readById(id);
      if (!existing) {
        throw new Error("Admin user not found");
      }
      await db.execute<MysqlResultHeader>(
        `UPDATE admin_users
         SET disabled_at = COALESCE(disabled_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id]
      );
      const updated = await readById(id);
      if (!updated) {
        throw new Error("Admin user could not be read");
      }
      return updated;
    },

    async logOperation(input: AdminOperationLog) {
      await db.execute<MysqlResultHeader>(
        `INSERT INTO admin_operation_logs (admin_id, action, target_type, target_id, detail_json)
         VALUES (?, ?, ?, ?, ?)`,
        [
          input.adminId,
          input.action,
          input.targetType,
          Number(input.targetId),
          input.detail === undefined ? null : JSON.stringify(input.detail)
        ]
      );
    }
  };
}
