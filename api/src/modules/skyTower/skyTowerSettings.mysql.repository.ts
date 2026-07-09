import type { SkyTowerConfigResponse } from "@auction/shared";
import { SkyTowerConfigParseError, mergeSkyTowerFloorOverrides, parseSkyTowerConfigText, skyTowerRewards } from "@auction/shared";
import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { firstRow, toIsoString } from "../../db/mysqlTypes";
import type { SkyTowerSettingsRepository } from "./skyTowerSettings.repository";

type SkyTowerSettingDbRow = {
  id: number;
  raw_text: string;
  updated_by: number | null;
  updated_at: Date | string;
};

const settingId = 1;

function toResponse(row: SkyTowerSettingDbRow | null): SkyTowerConfigResponse {
  const rawText = row?.raw_text ?? "";
  let items: ReturnType<typeof parseSkyTowerConfigText> = [];
  try {
    items = parseSkyTowerConfigText(rawText);
  } catch (error) {
    if (!(error instanceof SkyTowerConfigParseError)) {
      throw error;
    }
  }
  return {
    rawText,
    items,
    floors: mergeSkyTowerFloorOverrides(items),
    rewards: [...skyTowerRewards],
    updatedBy: row?.updated_by ?? null,
    updatedAt: row ? toIsoString(row.updated_at) : null
  };
}

export function createMysqlSkyTowerSettingsRepository(db: MysqlExecutor): SkyTowerSettingsRepository {
  async function readRow(): Promise<SkyTowerSettingDbRow | null> {
    const [rows] = await db.execute<SkyTowerSettingDbRow[]>(
      `SELECT id, raw_text, updated_by, updated_at
       FROM sky_tower_settings
       WHERE id = ?
       LIMIT 1`,
      [settingId]
    );
    return firstRow<SkyTowerSettingDbRow>(rows);
  }

  return {
    async read() {
      return toResponse(await readRow());
    },

    async update(rawText, updatedBy) {
      parseSkyTowerConfigText(rawText);
      await db.execute<MysqlResultHeader>(
        `INSERT INTO sky_tower_settings (id, raw_text, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE raw_text = VALUES(raw_text), updated_by = VALUES(updated_by)`,
        [settingId, rawText, updatedBy]
      );
      return toResponse(await readRow());
    }
  };
}
