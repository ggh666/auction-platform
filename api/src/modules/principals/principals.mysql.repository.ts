import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString } from "../../db/mysqlTypes";
import type { PrincipalRecord, PrincipalsRepository, UpsertPrincipalInput } from "./principals.repository";

type PrincipalDbRow = {
  id: number;
  admin_id: number;
  display_name: string;
  disabled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toPrincipalRecord(row: PrincipalDbRow): PrincipalRecord {
  return {
    id: String(row.id),
    adminId: String(row.admin_id),
    displayName: row.display_name,
    disabledAt: row.disabled_at === null ? null : toIsoString(row.disabled_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

const principalSelect = `
  SELECT id, admin_id, display_name, disabled_at, created_at, updated_at
  FROM principals
`;

export function createMysqlPrincipalsRepository(db: MysqlExecutor): PrincipalsRepository {
  async function readById(id: string): Promise<PrincipalRecord | null> {
    const [rows] = await db.execute<PrincipalDbRow[]>(`${principalSelect} WHERE id = ? LIMIT 1`, [Number(id)]);
    const row = firstRow<PrincipalDbRow>(rows);
    return row ? toPrincipalRecord(row) : null;
  }

  async function readByAdminId(adminId: string): Promise<PrincipalRecord | null> {
    const [rows] = await db.execute<PrincipalDbRow[]>(`${principalSelect} WHERE admin_id = ? LIMIT 1`, [Number(adminId)]);
    const row = firstRow<PrincipalDbRow>(rows);
    return row ? toPrincipalRecord(row) : null;
  }

  return {
    async listActive() {
      const [rows] = await db.execute<PrincipalDbRow[]>(
        `${principalSelect}
         WHERE disabled_at IS NULL
         ORDER BY id ASC`
      );
      return allRows<PrincipalDbRow>(rows).map((row) => {
        const principal = toPrincipalRecord(row);
        return { id: principal.id, displayName: principal.displayName };
      });
    },

    async listForAdmin() {
      const [rows] = await db.execute<PrincipalDbRow[]>(
        `${principalSelect}
         ORDER BY id ASC`
      );
      return allRows<PrincipalDbRow>(rows).map(toPrincipalRecord);
    },

    async findById(id) {
      return readById(id);
    },

    async findActiveById(id) {
      const [rows] = await db.execute<PrincipalDbRow[]>(
        `${principalSelect}
         WHERE id = ? AND disabled_at IS NULL
         LIMIT 1`,
        [Number(id)]
      );
      const row = firstRow<PrincipalDbRow>(rows);
      return row ? toPrincipalRecord(row) : null;
    },

    async findActiveByAdminId(adminId) {
      const [rows] = await db.execute<PrincipalDbRow[]>(
        `${principalSelect}
         WHERE admin_id = ? AND disabled_at IS NULL
         LIMIT 1`,
        [adminId]
      );
      const row = firstRow<PrincipalDbRow>(rows);
      return row ? toPrincipalRecord(row) : null;
    },

    async upsert(input: UpsertPrincipalInput) {
      const existing = await readByAdminId(input.adminId);
      if (existing) {
        const [result] = await db.execute<MysqlResultHeader>(
          `UPDATE principals
           SET display_name = ?, disabled_at = ?, updated_at = CURRENT_TIMESTAMP
           WHERE admin_id = ?`,
          [input.displayName.trim(), input.disabled ? new Date() : null, Number(input.adminId)]
        );
        if (result.affectedRows === 0) {
          throw new Error("Principal not found");
        }
        const updated = await readByAdminId(input.adminId);
        if (!updated) {
          throw new Error("Principal could not be read");
        }
        return updated;
      }

      const [result] = await db.execute<MysqlResultHeader>(
        `INSERT INTO principals (admin_id, display_name, disabled_at)
         VALUES (?, ?, ?)`,
        [Number(input.adminId), input.displayName.trim(), input.disabled ? new Date() : null]
      );
      const created = await readById(String(result.insertId));
      if (!created) {
        throw new Error("Principal could not be read");
      }
      return created;
    }
  };
}
