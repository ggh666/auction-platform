import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString } from "../../db/mysqlTypes";
import type { AssetFollowListInput, AssetFollowRecord, AssetFollowsRepository } from "./assetFollows.repository";

type AssetFollowDbRow = {
  user_id: number;
  asset_id: number;
  created_at: Date | string;
};

function normalizePage(input: AssetFollowListInput = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

function toAssetFollowRecord(row: AssetFollowDbRow): AssetFollowRecord {
  return {
    userId: String(row.user_id),
    assetId: String(row.asset_id),
    createdAt: toIsoString(row.created_at)
  };
}

export function createMysqlAssetFollowsRepository(db: MysqlExecutor): AssetFollowsRepository {
  async function readFollow(userId: string, assetId: string): Promise<AssetFollowRecord | null> {
    const [rows] = await db.execute<AssetFollowDbRow[]>(
      `SELECT user_id, asset_id, created_at
       FROM asset_follows
       WHERE user_id = ? AND asset_id = ?
       LIMIT 1`,
      [Number(userId), Number(assetId)]
    );
    const row = firstRow<AssetFollowDbRow>(rows);
    return row ? toAssetFollowRecord(row) : null;
  }

  return {
    async follow(userId, assetId) {
      await db.execute<MysqlResultHeader>(
        `INSERT INTO asset_follows (user_id, asset_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE created_at = created_at`,
        [Number(userId), Number(assetId)]
      );
      const record = await readFollow(userId, assetId);
      if (!record) {
        throw new Error("Asset follow could not be read");
      }
      return record;
    },

    async unfollow(userId, assetId) {
      await db.execute<MysqlResultHeader>(
        `DELETE FROM asset_follows
         WHERE user_id = ? AND asset_id = ?`,
        [Number(userId), Number(assetId)]
      );
    },

    async listByUser(userId, input = {}) {
      const { page, pageSize } = normalizePage(input);
      const offset = (page - 1) * pageSize;
      const [countRows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM asset_follows
         WHERE user_id = ?`,
        [Number(userId)]
      );
      const [rows] = await db.execute<AssetFollowDbRow[]>(
        `SELECT user_id, asset_id, created_at
         FROM asset_follows
         WHERE user_id = ?
         ORDER BY created_at DESC, asset_id DESC
         LIMIT ? OFFSET ?`,
        [Number(userId), pageSize, offset]
      );
      const countRow = firstRow<{ total: number | string }>(countRows);
      return {
        items: allRows<AssetFollowDbRow>(rows).map(toAssetFollowRecord),
        total: countRow ? Number(countRow.total) : 0,
        page,
        pageSize
      };
    },

    async listFollowedAssetIdsIn(userId, assetIds) {
      const uniqueAssetIds = [...new Set(assetIds)].filter((assetId) => Number.isInteger(Number(assetId)));
      if (uniqueAssetIds.length === 0) {
        return new Set<string>();
      }
      const placeholders = uniqueAssetIds.map(() => "?").join(", ");
      const [rows] = await db.execute<Array<{ asset_id: number }>>(
        `SELECT asset_id
         FROM asset_follows
         WHERE user_id = ? AND asset_id IN (${placeholders})`,
        [Number(userId), ...uniqueAssetIds.map(Number)]
      );
      return new Set(allRows<{ asset_id: number }>(rows).map((row) => String(row.asset_id)));
    }
  };
}
