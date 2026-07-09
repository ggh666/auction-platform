import type { SystemConfig } from "@auction/shared";
import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { firstRow, toIsoString } from "../../db/mysqlTypes";
import type { SystemConfigsRepository } from "./configs.repository";

type SystemConfigDbRow = {
  config_key: string;
  config_value: string;
  updated_by: number | null;
  updated_at: Date | string;
};

const configSelect = `
  SELECT config_key, config_value, updated_by, updated_at
  FROM system_configs
`;

function toSystemConfig(row: SystemConfigDbRow): SystemConfig {
  return {
    key: row.config_key,
    value: row.config_value,
    updatedBy: row.updated_by === null ? null : Number(row.updated_by),
    updatedAt: toIsoString(row.updated_at)
  };
}

export function createMysqlSystemConfigsRepository(db: MysqlExecutor): SystemConfigsRepository {
  async function findByKey(key: string): Promise<SystemConfig | null> {
    const [rows] = await db.execute<SystemConfigDbRow[]>(`${configSelect} WHERE config_key = ? LIMIT 1`, [key]);
    const row = firstRow<SystemConfigDbRow>(rows);
    return row ? toSystemConfig(row) : null;
  }

  return {
    findByKey,

    async list() {
      const [rows] = await db.execute<SystemConfigDbRow[]>(`${configSelect} ORDER BY config_key ASC`);
      return rows.map(toSystemConfig);
    },

    async update(key, value, updatedBy) {
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE system_configs
         SET config_value = ?, updated_by = ?
         WHERE config_key = ?`,
        [value, updatedBy, key]
      );
      if (result.affectedRows === 0) {
        throw new Error("Config not found");
      }

      const config = await findByKey(key);
      if (!config) {
        throw new Error("Config not found");
      }
      return config;
    }
  };
}
