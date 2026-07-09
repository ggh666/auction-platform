import type { RedeemCodeConfigResponse } from "@auction/shared";
import { parseRedeemCodeText } from "@auction/shared";
import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { firstRow, toIsoString } from "../../db/mysqlTypes";
import type { RedeemCodeSettingsRepository } from "./redeemCodeSettings.repository";

type RedeemCodeSettingDbRow = {
  id: number;
  raw_text: string;
  updated_by: number | null;
  updated_at: Date | string;
};

const settingId = 1;

function toResponse(row: RedeemCodeSettingDbRow | null): RedeemCodeConfigResponse {
  const rawText = row?.raw_text ?? "";
  return {
    rawText,
    items: parseRedeemCodeText(rawText),
    updatedBy: row?.updated_by ?? null,
    updatedAt: row ? toIsoString(row.updated_at) : null
  };
}

export function createMysqlRedeemCodeSettingsRepository(db: MysqlExecutor): RedeemCodeSettingsRepository {
  async function readRow(): Promise<RedeemCodeSettingDbRow | null> {
    const [rows] = await db.execute<RedeemCodeSettingDbRow[]>(
      `SELECT id, raw_text, updated_by, updated_at
       FROM redeem_code_settings
       WHERE id = ?
       LIMIT 1`,
      [settingId]
    );
    return firstRow<RedeemCodeSettingDbRow>(rows);
  }

  return {
    async read() {
      return toResponse(await readRow());
    },

    async update(rawText, updatedBy) {
      parseRedeemCodeText(rawText);
      await db.execute<MysqlResultHeader>(
        `INSERT INTO redeem_code_settings (id, raw_text, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE raw_text = VALUES(raw_text), updated_by = VALUES(updated_by)`,
        [settingId, rawText, updatedBy]
      );
      return toResponse(await readRow());
    }
  };
}
