import type {
  DragonBallPriceReferenceBatch,
  DragonBallPriceReferenceItem,
  DragonBallPriceReferenceTrendItem,
  DragonBallPriceReferenceProfession,
  DragonBallQuality
} from "@auction/shared";
import type { MysqlConnection, MysqlPool, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString } from "../../db/mysqlTypes";
import type {
  DragonBallPriceReferenceBatchInput,
  DragonBallPriceReferencePageInput,
  DragonBallPriceReferencesRepository
} from "./dragonBallPriceReferences.repository";

type BatchDbRow = {
  id: number;
  game_name: string;
  week_start_date: Date | string;
  week_end_date: Date | string;
  note: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type ItemDbRow = {
  id: number;
  batch_id: number;
  profession: DragonBallPriceReferenceProfession;
  quality: DragonBallQuality;
  min_price_cents: number | string;
  max_price_cents: number | string;
  created_at: Date | string;
  updated_at: Date | string;
};

type TrendDbRow = {
  batch_id: number;
  game_name: string;
  week_start_date: Date | string;
  week_end_date: Date | string;
  profession: DragonBallPriceReferenceProfession;
  quality: DragonBallQuality;
  min_price_cents: number | string;
  max_price_cents: number | string;
};

function toDateOnly(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function normalizePage(input: DragonBallPriceReferencePageInput = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

function toItem(row: ItemDbRow): DragonBallPriceReferenceItem {
  return {
    id: String(row.id),
    batchId: String(row.batch_id),
    profession: row.profession,
    quality: row.quality,
    minPriceCents: Number(row.min_price_cents),
    maxPriceCents: Number(row.max_price_cents),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function toBatch(row: BatchDbRow, items: DragonBallPriceReferenceItem[]): DragonBallPriceReferenceBatch {
  return {
    id: String(row.id),
    gameName: row.game_name,
    weekStartDate: toDateOnly(row.week_start_date),
    weekEndDate: toDateOnly(row.week_end_date),
    note: row.note,
    items,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

async function insertItems(
  executor: MysqlConnection,
  batchId: string,
  input: DragonBallPriceReferenceBatchInput["items"]
): Promise<void> {
  if (input.length === 0) {
    return;
  }

  const placeholders = input.map(() => "(?, ?, ?, ?, ?)").join(", ");
  const params = input.flatMap((item) => [
    Number(batchId),
    item.profession,
    item.quality,
    item.minPriceCents,
    item.maxPriceCents
  ]);
  await executor.execute<MysqlResultHeader>(
    `INSERT INTO dragon_ball_price_reference_items
       (batch_id, profession, quality, min_price_cents, max_price_cents)
     VALUES ${placeholders}`,
    params
  );
}

export function createMysqlDragonBallPriceReferencesRepository(pool: MysqlPool): DragonBallPriceReferencesRepository {
  async function readItems(batchId: string): Promise<DragonBallPriceReferenceItem[]> {
    const [rows] = await pool.execute<ItemDbRow[]>(
      `SELECT id, batch_id, profession, quality, min_price_cents, max_price_cents, created_at, updated_at
       FROM dragon_ball_price_reference_items
       WHERE batch_id = ?
       ORDER BY FIELD(quality, '红', '金', '紫', '蓝', '绿'), FIELD(profession, '战士', '法师', '猎人', '召唤', '术士', '牧师', '熊猫', '工程'), id`,
      [Number(batchId)]
    );
    return allRows<ItemDbRow>(rows).map(toItem);
  }

  async function readBatch(batchId: string): Promise<DragonBallPriceReferenceBatch | null> {
    const [rows] = await pool.execute<BatchDbRow[]>(
      `SELECT id, game_name, week_start_date, week_end_date, note, created_at, updated_at
       FROM dragon_ball_price_reference_batches
       WHERE id = ?
       LIMIT 1`,
      [Number(batchId)]
    );
    const row = firstRow<BatchDbRow>(rows);
    if (!row) {
      return null;
    }
    return toBatch(row, await readItems(String(row.id)));
  }

  async function replaceItems(connection: MysqlConnection, batchId: string, input: DragonBallPriceReferenceBatchInput["items"]) {
    await connection.execute<MysqlResultHeader>("DELETE FROM dragon_ball_price_reference_items WHERE batch_id = ?", [
      Number(batchId)
    ]);
    await insertItems(connection, batchId, input);
  }

  return {
    async listBatches(input = {}) {
      const { page, pageSize } = normalizePage(input);
      const [countRows] = await pool.execute<Array<{ total: number | string }>>(
        "SELECT COUNT(*) AS total FROM dragon_ball_price_reference_batches"
      );
      const total = Number(firstRow<{ total: number | string }>(countRows)?.total ?? 0);
      const [rows] = await pool.execute<BatchDbRow[]>(
        `SELECT id, game_name, week_start_date, week_end_date, note, created_at, updated_at
         FROM dragon_ball_price_reference_batches
         ORDER BY week_start_date DESC, id DESC
         LIMIT ? OFFSET ?`,
        [pageSize, (page - 1) * pageSize]
      );
      const batches = await Promise.all(
        allRows<BatchDbRow>(rows).map(async (row) => toBatch(row, await readItems(String(row.id))))
      );
      return { items: batches, total, page, pageSize, hasMore: page * pageSize < total };
    },

    async findBatchById(batchId) {
      return readBatch(batchId);
    },

    async upsertBatch(input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.execute<MysqlResultHeader>(
          `INSERT INTO dragon_ball_price_reference_batches (game_name, week_start_date, week_end_date, note)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             week_end_date = VALUES(week_end_date),
             note = VALUES(note),
             updated_at = CURRENT_TIMESTAMP,
             id = LAST_INSERT_ID(id)`,
          [input.gameName, input.weekStartDate, input.weekEndDate, input.note]
        );
        const batchId = String(result.insertId);
        await replaceItems(connection, batchId, input.items);
        await connection.commit();
        const batch = await readBatch(batchId);
        if (!batch) {
          throw new Error("Dragon ball price reference batch could not be read");
        }
        return batch;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async updateBatch(batchId, input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.execute<MysqlResultHeader>(
          `UPDATE dragon_ball_price_reference_batches
           SET game_name = ?, week_start_date = ?, week_end_date = ?, note = ?
           WHERE id = ?`,
          [input.gameName, input.weekStartDate, input.weekEndDate, input.note, Number(batchId)]
        );
        if (result.affectedRows === 0) {
          await connection.rollback();
          return null;
        }
        await replaceItems(connection, batchId, input.items);
        await connection.commit();
        return readBatch(batchId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async deleteBatch(batchId) {
      const existing = await readBatch(batchId);
      if (!existing) {
        return null;
      }
      await pool.execute<MysqlResultHeader>("DELETE FROM dragon_ball_price_reference_batches WHERE id = ?", [Number(batchId)]);
      return existing;
    },

    async latest(gameName) {
      const [rows] = await pool.execute<BatchDbRow[]>(
        `SELECT id, game_name, week_start_date, week_end_date, note, created_at, updated_at
         FROM dragon_ball_price_reference_batches
         WHERE game_name = ?
         ORDER BY week_start_date DESC, id DESC
         LIMIT 1`,
        [gameName]
      );
      const row = firstRow<BatchDbRow>(rows);
      return row ? toBatch(row, await readItems(String(row.id))) : null;
    },

    async trend(input) {
      const limit = Number.isInteger(input.limit) && input.limit && input.limit > 0 ? Math.min(input.limit, 52) : 12;
      const [rows] = await pool.execute<TrendDbRow[]>(
        `SELECT
           b.id AS batch_id,
           b.game_name,
           b.week_start_date,
           b.week_end_date,
           i.profession,
           i.quality,
           i.min_price_cents,
           i.max_price_cents
         FROM dragon_ball_price_reference_batches b
         JOIN dragon_ball_price_reference_items i ON i.batch_id = b.id
         WHERE b.game_name = ? AND i.profession = ? AND i.quality = ?
         ORDER BY b.week_start_date DESC, b.id DESC
         LIMIT ?`,
        [input.gameName, input.profession, input.quality, limit]
      );
      return allRows<TrendDbRow>(rows)
        .map<DragonBallPriceReferenceTrendItem>((row) => ({
          batchId: String(row.batch_id),
          gameName: row.game_name,
          weekStartDate: toDateOnly(row.week_start_date),
          weekEndDate: toDateOnly(row.week_end_date),
          profession: row.profession,
          quality: row.quality,
          minPriceCents: Number(row.min_price_cents),
          maxPriceCents: Number(row.max_price_cents)
        }))
        .sort((left, right) => left.weekStartDate.localeCompare(right.weekStartDate));
    }
  };
}
