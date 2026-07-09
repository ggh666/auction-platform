import type { AnchorRecommendation } from "@auction/shared";
import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString } from "../../db/mysqlTypes";
import type { AnchorRecommendationInput, AnchorRecommendationsRepository } from "./anchorRecommendations.repository";

type AnchorRecommendationDbRow = {
  id: number;
  name: string;
  intro: string;
  image_url: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function toAnchor(row: AnchorRecommendationDbRow): AnchorRecommendation {
  return {
    id: String(row.id),
    name: row.name,
    intro: row.intro,
    imageUrl: row.image_url,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export function createMysqlAnchorRecommendationsRepository(db: MysqlExecutor): AnchorRecommendationsRepository {
  async function findById(id: string): Promise<AnchorRecommendation | null> {
    const [rows] = await db.execute<AnchorRecommendationDbRow[]>(
      `SELECT id, name, intro, image_url, created_at, updated_at
       FROM anchor_recommendations
       WHERE id = ?
       LIMIT 1`,
      [Number(id)]
    );
    const row = firstRow<AnchorRecommendationDbRow>(rows);
    return row ? toAnchor(row) : null;
  }

  return {
    async list() {
      const [rows] = await db.execute<AnchorRecommendationDbRow[]>(
        `SELECT id, name, intro, image_url, created_at, updated_at
         FROM anchor_recommendations
         ORDER BY updated_at DESC, id DESC`
      );
      return allRows<AnchorRecommendationDbRow>(rows).map(toAnchor);
    },

    async create(input: AnchorRecommendationInput) {
      const [result] = await db.execute<MysqlResultHeader>(
        `INSERT INTO anchor_recommendations (name, intro, image_url)
         VALUES (?, ?, ?)`,
        [input.name, input.intro, input.imageUrl]
      );
      const created = await findById(String(result.insertId));
      if (!created) {
        throw new Error("Anchor recommendation could not be read");
      }
      return created;
    },

    async update(id, input) {
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE anchor_recommendations
         SET name = ?, intro = ?, image_url = ?
         WHERE id = ?`,
        [input.name, input.intro, input.imageUrl, Number(id)]
      );
      if (result.affectedRows === 0) {
        return null;
      }
      return findById(id);
    },

    async delete(id) {
      const [result] = await db.execute<MysqlResultHeader>("DELETE FROM anchor_recommendations WHERE id = ?", [Number(id)]);
      return result.affectedRows > 0;
    }
  };
}
