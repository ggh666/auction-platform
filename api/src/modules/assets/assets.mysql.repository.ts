import { dragonBallElementForProfession, isDragonBallProfession, isDragonBallQuality } from "@auction/shared";
import type { AssetStatus, AuctionAsset, DragonBallInfo } from "@auction/shared";
import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString, toMysqlDate } from "../../db/mysqlTypes";
import {
  defaultAdminAssetStatuses,
  approvedAuctionEndAt,
  normalizeActiveAssetEndAt,
  type AdminAssetListInput,
  type AssetsRepository,
  type CreateAssetInput,
  type PublicAssetListInput,
  type SoldFollowupCandidateInput
} from "./assets.repository";

export type AssetDbRow = {
  id: number;
  seller_id: number;
  principal_id: number | null;
  game_name: string;
  server_name: string;
  asset_type: string;
  item_category?: string | null;
  dragon_ball_profession?: string | null;
  dragon_ball_quality?: string | null;
  dragon_ball_attributes?: string | null;
  title: string;
  description: string;
  status: AssetStatus;
  starting_price_cents: number;
  current_price_cents: number | null;
  min_increment_cents: number;
  highest_bidder_id: number | null;
  original_end_at: Date | string;
  effective_end_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

const assetSelect = `
  SELECT
    id,
    seller_id,
    principal_id,
    game_name,
    server_name,
    asset_type,
    item_category,
    dragon_ball_profession,
    dragon_ball_quality,
    dragon_ball_attributes,
    title,
    description,
    status,
    starting_price_cents,
    current_price_cents,
    min_increment_cents,
    highest_bidder_id,
    original_end_at,
    effective_end_at,
    created_at,
    updated_at
  FROM auction_assets
`;

export function toAuctionAsset(row: AssetDbRow, imageUrls: string[] = []): AuctionAsset {
  const profession = row.dragon_ball_profession ?? "";
  const quality = row.dragon_ball_quality ?? "";
  const attributes = row.dragon_ball_attributes ?? "";
  const element = row.item_category === "龙珠" ? dragonBallElementForProfession(profession) : null;
  const dragonBall: DragonBallInfo | null =
    element && attributes && isDragonBallProfession(profession) && isDragonBallQuality(quality)
      ? { element, profession, quality, attributes }
      : null;
  return normalizeActiveAssetEndAt({
    id: String(row.id),
    sellerId: String(row.seller_id),
    principalId: row.principal_id === null ? null : String(row.principal_id),
    gameName: row.game_name,
    serverName: row.server_name,
    assetType: row.asset_type,
    itemCategory: row.item_category ?? null,
    dragonBall,
    title: row.title,
    description: row.description,
    imageUrls,
    status: row.status,
    startingPriceCents: Number(row.starting_price_cents),
    currentPriceCents: row.current_price_cents === null ? null : Number(row.current_price_cents),
    minIncrementCents: Number(row.min_increment_cents),
    highestBidderId: row.highest_bidder_id === null ? null : String(row.highest_bidder_id),
    originalEndAt: toIsoString(row.original_end_at),
    effectiveEndAt: toIsoString(row.effective_end_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  });
}

export function createMysqlAssetsRepository(db: MysqlExecutor): AssetsRepository {
  function normalizeListInput(input: Pick<AdminAssetListInput, "page" | "pageSize"> = {}) {
    const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
    const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
    return { page, pageSize: Math.min(requestedPageSize, 100) };
  }

  function normalizeAdminListInput(input: AdminAssetListInput = {}) {
    return { ...input, ...normalizeListInput(input) };
  }

  function normalizePublicListInput(input: PublicAssetListInput = {}) {
    return { ...input, ...normalizeListInput(input) };
  }

  function buildAdminAssetWhere(input: AdminAssetListInput) {
    const where: string[] = [];
    const params: unknown[] = [];
    const keyword = input.keyword?.trim() ?? "";
    if (keyword) {
      const keywordId = /^\d+$/.test(keyword) ? Number(keyword) : null;
      if (keywordId !== null && Number.isSafeInteger(keywordId)) {
        where.push("(id = ? OR seller_id = ? OR title LIKE ?)");
        params.push(keywordId, keywordId, `%${keyword}%`);
      } else {
        where.push("title LIKE ?");
        params.push(`%${keyword}%`);
      }
    }
    if (input.status) {
      where.push("status = ?");
      params.push(input.status);
    } else {
      const statuses = input.statuses ?? defaultAdminAssetStatuses;
      if (statuses.length > 0) {
        where.push(`status IN (${statuses.map(() => "?").join(", ")})`);
        params.push(...statuses);
      }
    }
    if (input.gameName?.trim()) {
      where.push("game_name = ?");
      params.push(input.gameName.trim());
    }
    if (input.assetType?.trim()) {
      where.push("asset_type = ?");
      params.push(input.assetType.trim());
    }
    if (input.principalId) {
      where.push("principal_id = ?");
      params.push(Number(input.principalId));
    }
    return {
      clause: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
      params
    };
  }

  function buildPublicAssetWhere(input: PublicAssetListInput = {}) {
    const where = ["status = 'active'"];
    const params: unknown[] = [];
    if (input.nowIso) {
      where.push("effective_end_at > ?");
      params.push(toMysqlDate(input.nowIso));
    }
    if (input.createdSince) {
      where.push("created_at >= ?");
      params.push(toMysqlDate(input.createdSince));
    }
    if (input.gameName?.trim()) {
      where.push("game_name = ?");
      params.push(input.gameName.trim());
    }
    const assetType = input.assetType?.trim();
    if (assetType === "道具") {
      where.push("asset_type IN (?, ?)");
      params.push("道具", "装备");
    } else if (assetType) {
      where.push("asset_type = ?");
      params.push(assetType);
    }
    const keyword = input.keyword?.trim();
    if (keyword) {
      where.push("(title LIKE ? OR server_name LIKE ? OR description LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    return { clause: `WHERE ${where.join(" AND ")}`, params };
  }

  function principalScopeWhere(input: Pick<AdminAssetListInput, "principalId"> = {}) {
    return input.principalId ? { clause: " AND principal_id = ?", params: [Number(input.principalId)] } : { clause: "", params: [] };
  }

  function soldFollowupCandidateWhere(input: SoldFollowupCandidateInput = {}) {
    const where = [
      "current_price_cents IS NOT NULL",
      "highest_bidder_id IS NOT NULL",
      "(status = 'ended' OR effective_end_at <= ?)"
    ];
    const params: unknown[] = [toMysqlDate(input.nowIso ?? new Date().toISOString())];
    if (input.principalId) {
      where.push("principal_id = ?");
      params.push(Number(input.principalId));
    }
    if (input.userId) {
      where.push("(seller_id = ? OR highest_bidder_id = ?)");
      params.push(Number(input.userId), Number(input.userId));
    }
    return { clause: `WHERE ${where.join(" AND ")}`, params };
  }

  async function readById(id: string, input: Pick<AdminAssetListInput, "principalId"> = {}): Promise<AuctionAsset | null> {
    const scope = principalScopeWhere(input);
    const [rows] = await db.execute<AssetDbRow[]>(
      `${assetSelect}
       WHERE id = ?${scope.clause}
       LIMIT 1`,
      [Number(id), ...scope.params]
    );
    const row = firstRow<AssetDbRow>(rows);
    if (!row) {
      return null;
    }
    return toAuctionAsset(row, await readImageUrls(String(row.id)));
  }

  async function readImageUrls(assetId: string): Promise<string[]> {
    const [rows] = await db.execute<Array<{ public_url: string }>>(
      `SELECT public_url
       FROM asset_images
       WHERE asset_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [Number(assetId)]
    );
    return allRows<{ public_url: string }>(rows).map((row) => row.public_url);
  }

  return {
    async createPending(input: CreateAssetInput) {
      const [result] = await db.execute<MysqlResultHeader>(
        `INSERT INTO auction_assets (
           seller_id,
           principal_id,
           game_name,
           server_name,
           asset_type,
           item_category,
           dragon_ball_profession,
           dragon_ball_quality,
           dragon_ball_attributes,
           title,
           description,
           status,
           starting_price_cents,
           current_price_cents,
           min_increment_cents,
           highest_bidder_id,
           original_end_at,
           effective_end_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, NULL, ?, NULL, ?, ?)`,
        [
          Number(input.sellerId),
          input.principalId ? Number(input.principalId) : null,
          input.gameName,
          input.serverName,
          input.assetType,
          input.itemCategory ?? null,
          input.dragonBall?.profession ?? null,
          input.dragonBall?.quality ?? null,
          input.dragonBall?.attributes ?? null,
          input.title,
          input.description,
          input.startingPriceCents,
          input.minIncrementCents,
          toMysqlDate(input.originalEndAt),
          toMysqlDate(input.originalEndAt)
        ]
      );
      const createdAsset = await readById(String(result.insertId));
      if (!createdAsset) {
        throw new Error("Created asset could not be read");
      }
      for (const [index, image] of (input.images ?? []).entries()) {
        await db.execute<MysqlResultHeader>(
          `INSERT INTO asset_images (asset_id, uploader_id, object_key, public_url, mime_type, size_bytes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(createdAsset.id),
            Number(input.sellerId),
            image.objectKey,
            image.publicUrl,
            image.mimeType,
            image.sizeBytes,
            index
          ]
        );
      }
      const asset = await readById(String(result.insertId));
      if (!asset) {
        throw new Error("Created asset could not be read");
      }
      return asset;
    },

    async countCreatedBySellerSince(sellerId, since) {
      const [rows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM auction_assets
         WHERE seller_id = ? AND created_at >= ?`,
        [Number(sellerId), toMysqlDate(since)]
      );
      const row = firstRow<{ total: number | string }>(rows);
      return row ? Number(row.total) : 0;
    },

    async countCreatedSince(since, input = {}) {
      const scope = principalScopeWhere(input);
      const [rows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM auction_assets
         WHERE created_at >= ?${scope.clause}`,
        [toMysqlDate(since), ...scope.params]
      );
      const row = firstRow<{ total: number | string }>(rows);
      return row ? Number(row.total) : 0;
    },

    async countByStatus(status, input = {}) {
      const scope = principalScopeWhere(input);
      const [rows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM auction_assets
         WHERE status = ?${scope.clause}`,
        [status, ...scope.params]
      );
      const row = firstRow<{ total: number | string }>(rows);
      return row ? Number(row.total) : 0;
    },

    async listActive(input = {}) {
      const normalized = normalizePublicListInput(input);
      const { clause, params } = buildPublicAssetWhere(normalized);
      const offset = (normalized.page - 1) * normalized.pageSize;
      const [countRows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM auction_assets
         ${clause}`,
        params
      );
      const [rows] = await db.execute<AssetDbRow[]>(
        `${assetSelect}
         ${clause}
         ORDER BY effective_end_at ASC, created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, normalized.pageSize, offset]
      );
      const countRow = firstRow<{ total: number | string }>(countRows);
      return {
        items: await Promise.all(allRows<AssetDbRow>(rows).map(async (row) => toAuctionAsset(row, await readImageUrls(String(row.id))))),
        total: countRow ? Number(countRow.total) : 0,
        page: normalized.page,
        pageSize: normalized.pageSize
      };
    },

    async listForAdmin(input = {}) {
      const normalized = normalizeAdminListInput(input);
      const { clause, params } = buildAdminAssetWhere(normalized);
      const offset = (normalized.page - 1) * normalized.pageSize;
      const [countRows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM auction_assets
         ${clause}`,
        params
      );
      const [rows] = await db.execute<AssetDbRow[]>(
        `${assetSelect}
         ${clause}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, normalized.pageSize, offset]
      );
      const countRow = firstRow<{ total: number | string }>(countRows);
      return {
        items: await Promise.all(allRows<AssetDbRow>(rows).map(async (row) => toAuctionAsset(row, await readImageUrls(String(row.id))))),
        total: countRow ? Number(countRow.total) : 0,
        page: normalized.page,
        pageSize: normalized.pageSize
      };
    },

    async listPendingReview(input = {}) {
      const scope = principalScopeWhere(input);
      const normalized = normalizeAdminListInput(input);
      const offset = (normalized.page - 1) * normalized.pageSize;
      const [countRows] = await db.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM auction_assets
         WHERE status = 'pending_review'${scope.clause}`,
        scope.params
      );
      const [rows] = await db.execute<AssetDbRow[]>(
        `${assetSelect}
         WHERE status = 'pending_review'${scope.clause}
         ORDER BY created_at ASC
         LIMIT ? OFFSET ?`,
        [...scope.params, normalized.pageSize, offset]
      );
      const countRow = firstRow<{ total: number | string }>(countRows);
      return {
        items: await Promise.all(allRows<AssetDbRow>(rows).map(async (row) => toAuctionAsset(row, await readImageUrls(String(row.id))))),
        total: countRow ? Number(countRow.total) : 0,
        page: normalized.page,
        pageSize: normalized.pageSize
      };
    },

    async listBySeller(sellerId) {
      const [rows] = await db.execute<AssetDbRow[]>(
        `${assetSelect}
         WHERE seller_id = ?
         ORDER BY created_at DESC`,
        [Number(sellerId)]
      );
      return Promise.all(allRows<AssetDbRow>(rows).map(async (row) => toAuctionAsset(row, await readImageUrls(String(row.id)))));
    },

    async listRelatedResults(userId) {
      const [rows] = await db.execute<AssetDbRow[]>(
        `${assetSelect}
         WHERE seller_id = ? OR highest_bidder_id = ?
         ORDER BY updated_at DESC`,
        [Number(userId), Number(userId)]
      );
      const assets = await Promise.all(
        allRows<AssetDbRow>(rows).map(async (row) => toAuctionAsset(row, await readImageUrls(String(row.id))))
      );
      return assets.filter((asset) => asset.currentPriceCents !== null || asset.status === "ended");
    },

    async listSoldFollowupCandidates(input = {}) {
      const { clause, params } = soldFollowupCandidateWhere(input);
      const limit = Number.isInteger(input.limit) && input.limit && input.limit > 0 ? Math.min(input.limit, 500) : 200;
      const [rows] = await db.execute<AssetDbRow[]>(
        `${assetSelect}
         ${clause}
         ORDER BY updated_at DESC, id DESC
         LIMIT ?`,
        [...params, limit]
      );
      return Promise.all(allRows<AssetDbRow>(rows).map(async (row) => toAuctionAsset(row, await readImageUrls(String(row.id)))));
    },

    async findById(id, input = {}) {
      return readById(id, input);
    },

    async approvePending(id, input = {}) {
      const scope = principalScopeWhere(input);
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE auction_assets
         SET status = 'active', effective_end_at = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending_review'${scope.clause}`,
        [toMysqlDate(approvedAuctionEndAt()), Number(id), ...scope.params]
      );
      if (result.affectedRows === 0) {
        const existing = await readById(id, input);
        if (!existing) {
          throw new Error("Asset not found");
        }
        throw new Error("Invalid asset state");
      }
      const asset = await readById(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      return asset;
    },

    async rejectPending(id, note, input = {}) {
      const scope = principalScopeWhere(input);
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE auction_assets
         SET status = 'rejected', review_note = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending_review'${scope.clause}`,
        [note?.trim() ? note.trim() : null, Number(id), ...scope.params]
      );
      if (result.affectedRows === 0) {
        const existing = await readById(id, input);
        if (!existing) {
          throw new Error("Asset not found");
        }
        throw new Error("Invalid asset state");
      }
      const asset = await readById(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      return asset;
    },

    async removeActive(id, input = {}) {
      const scope = principalScopeWhere(input);
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE auction_assets
         SET status = 'removed', ended_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'active'${scope.clause}`,
        [Number(id), ...scope.params]
      );
      if (result.affectedRows === 0) {
        const existing = await readById(id, input);
        if (!existing) {
          throw new Error("Asset not found");
        }
        throw new Error("Invalid asset state");
      }
      const asset = await readById(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      return asset;
    },

    async confirmActiveDeal(id, input = {}) {
      const scope = principalScopeWhere(input);
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE auction_assets
         SET status = 'ended', effective_end_at = CURRENT_TIMESTAMP, ended_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND status = 'active'
           AND current_price_cents IS NOT NULL
           AND highest_bidder_id IS NOT NULL${scope.clause}`,
        [Number(id), ...scope.params]
      );
      if (result.affectedRows === 0) {
        const existing = await readById(id, input);
        if (!existing) {
          throw new Error("Asset not found");
        }
        throw new Error("Invalid asset state");
      }
      const asset = await readById(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      return asset;
    },

    async updateStatus(id, status) {
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE auction_assets
         SET status = ?
         WHERE id = ?`,
        [status, Number(id)]
      );
      if (result.affectedRows === 0) {
        throw new Error("Asset not found");
      }
      const asset = await readById(id);
      if (!asset) {
        throw new Error("Asset not found");
      }
      return asset;
    },

    async save(asset) {
      const [result] = await db.execute<MysqlResultHeader>(
        `UPDATE auction_assets
         SET
           seller_id = ?,
           principal_id = ?,
           game_name = ?,
           server_name = ?,
           asset_type = ?,
           item_category = ?,
           dragon_ball_profession = ?,
           dragon_ball_quality = ?,
           dragon_ball_attributes = ?,
           title = ?,
           description = ?,
           status = ?,
           starting_price_cents = ?,
           current_price_cents = ?,
           min_increment_cents = ?,
           highest_bidder_id = ?,
           original_end_at = ?,
           effective_end_at = ?
         WHERE id = ?`,
        [
          Number(asset.sellerId),
          asset.principalId === null ? null : Number(asset.principalId),
          asset.gameName,
          asset.serverName,
          asset.assetType,
          asset.itemCategory ?? null,
          asset.dragonBall?.profession ?? null,
          asset.dragonBall?.quality ?? null,
          asset.dragonBall?.attributes ?? null,
          asset.title,
          asset.description,
          asset.status,
          asset.startingPriceCents,
          asset.currentPriceCents,
          asset.minIncrementCents,
          asset.highestBidderId === null ? null : Number(asset.highestBidderId),
          toMysqlDate(asset.originalEndAt),
          toMysqlDate(asset.effectiveEndAt),
          Number(asset.id)
        ]
      );
      if (result.affectedRows === 0) {
        throw new Error("Asset not found");
      }
      const updated = await readById(asset.id);
      if (!updated) {
        throw new Error("Asset not found");
      }
      return updated;
    }
  };
}
