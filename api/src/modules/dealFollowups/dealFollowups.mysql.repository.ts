import type { DealFollowupStatus } from "@auction/shared";
import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString, toMysqlDate } from "../../db/mysqlTypes";
import {
  isSoldFollowupAsset,
  type AdminDealFollowupStatus,
  type DealFollowupListInput,
  type DealFollowupRecord,
  type DealFollowupsRepository
} from "./dealFollowups.repository";

type DealFollowupDbRow = {
  id: number;
  asset_id: number;
  principal_id: number | null;
  seller_id: number;
  buyer_id: number;
  final_price_cents: number;
  status: DealFollowupStatus;
  note: string | null;
  buyer_confirmed_at: Date | string | null;
  buyer_abandoned_at: Date | string | null;
  principal_contacted_at: Date | string | null;
  buyer_unreachable_at: Date | string | null;
  completed_at: Date | string | null;
  cancelled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const followupSelect = `
  SELECT
    id,
    asset_id,
    principal_id,
    seller_id,
    buyer_id,
    final_price_cents,
    status,
    note,
    buyer_confirmed_at,
    buyer_abandoned_at,
    principal_contacted_at,
    buyer_unreachable_at,
    completed_at,
    cancelled_at,
    created_at,
    updated_at
  FROM deal_followups
`;

const statusTimestampColumns: Record<DealFollowupStatus, string | null> = {
  pending_buyer_confirm: null,
  buyer_confirmed: "buyer_confirmed_at",
  buyer_abandoned: "buyer_abandoned_at",
  principal_contacted: "principal_contacted_at",
  buyer_unreachable: "buyer_unreachable_at",
  completed: "completed_at",
  cancelled: "cancelled_at"
};

function toNullableIsoString(value: Date | string | null): string | null {
  return value === null ? null : toIsoString(value);
}

function toFollowupRecord(row: DealFollowupDbRow): DealFollowupRecord {
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    principalId: row.principal_id === null ? null : String(row.principal_id),
    sellerId: String(row.seller_id),
    buyerId: String(row.buyer_id),
    finalPriceCents: Number(row.final_price_cents),
    status: row.status,
    note: row.note,
    buyerConfirmedAt: toNullableIsoString(row.buyer_confirmed_at),
    buyerAbandonedAt: toNullableIsoString(row.buyer_abandoned_at),
    principalContactedAt: toNullableIsoString(row.principal_contacted_at),
    buyerUnreachableAt: toNullableIsoString(row.buyer_unreachable_at),
    completedAt: toNullableIsoString(row.completed_at),
    cancelledAt: toNullableIsoString(row.cancelled_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function normalizePage(input: Pick<DealFollowupListInput, "page" | "pageSize"> = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

export function createMysqlDealFollowupsRepository(db: MysqlExecutor): DealFollowupsRepository {
  async function readById(id: string): Promise<DealFollowupRecord | null> {
    const [rows] = await db.execute<DealFollowupDbRow[]>(
      `${followupSelect}
       WHERE id = ?
       LIMIT 1`,
      [Number(id)]
    );
    const row = firstRow<DealFollowupDbRow>(rows);
    return row ? toFollowupRecord(row) : null;
  }

  async function readByAssetId(assetId: string): Promise<DealFollowupRecord | null> {
    const [rows] = await db.execute<DealFollowupDbRow[]>(
      `${followupSelect}
       WHERE asset_id = ?
       LIMIT 1`,
      [Number(assetId)]
    );
    const row = firstRow<DealFollowupDbRow>(rows);
    return row ? toFollowupRecord(row) : null;
  }

  function buildListWhere(input: DealFollowupListInput = {}) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (input.principalId) {
      where.push("principal_id = ?");
      params.push(Number(input.principalId));
    }
    if (input.buyerId) {
      where.push("buyer_id = ?");
      params.push(Number(input.buyerId));
    }
    if (input.status) {
      where.push("status = ?");
      params.push(input.status);
    }
    return { clause: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "", params };
  }

  async function list(input: DealFollowupListInput = {}) {
    const normalized = normalizePage(input);
    const { clause, params } = buildListWhere(input);
    const offset = (normalized.page - 1) * normalized.pageSize;
    const [countRows] = await db.execute<Array<{ total: number | string }>>(
      `SELECT COUNT(*) AS total
       FROM deal_followups
       ${clause}`,
      params
    );
    const [rows] = await db.execute<DealFollowupDbRow[]>(
      `${followupSelect}
       ${clause}
       ORDER BY updated_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, normalized.pageSize, offset]
    );
    const countRow = firstRow<{ total: number | string }>(countRows);
    return {
      items: allRows<DealFollowupDbRow>(rows).map(toFollowupRecord),
      total: countRow ? Number(countRow.total) : 0,
      page: normalized.page,
      pageSize: normalized.pageSize
    };
  }

  async function updateStatus(
    id: string,
    status: DealFollowupStatus,
    input: { buyerId?: string; note?: string | null } = {}
  ): Promise<DealFollowupRecord | null> {
    const timestampColumn = statusTimestampColumns[status];
    const buyerClause = input.buyerId ? " AND buyer_id = ?" : "";
    const params: unknown[] = [status, input.note ?? null, Number(id)];
    if (input.buyerId) {
      params.push(Number(input.buyerId));
    }
    const timestampSql = timestampColumn ? `, ${timestampColumn} = COALESCE(${timestampColumn}, CURRENT_TIMESTAMP)` : "";
    const [result] = await db.execute<MysqlResultHeader>(
      `UPDATE deal_followups
       SET status = ?, note = ?, updated_at = CURRENT_TIMESTAMP${timestampSql}
       WHERE id = ?${buyerClause}`,
      params
    );
    if (result.affectedRows === 0) {
      return null;
    }
    return readById(id);
  }

  return {
    async ensureForSoldAsset(asset) {
      if (!isSoldFollowupAsset(asset)) {
        return null;
      }
      await db.execute<MysqlResultHeader>(
        `INSERT INTO deal_followups (
           asset_id,
           principal_id,
           seller_id,
           buyer_id,
           final_price_cents,
           status
         )
         VALUES (?, ?, ?, ?, ?, 'pending_buyer_confirm')
         ON DUPLICATE KEY UPDATE
           principal_id = VALUES(principal_id),
           seller_id = VALUES(seller_id),
           buyer_id = VALUES(buyer_id),
           final_price_cents = VALUES(final_price_cents),
           updated_at = CURRENT_TIMESTAMP`,
        [
          Number(asset.id),
          asset.principalId === null ? null : Number(asset.principalId),
          Number(asset.sellerId),
          Number(asset.highestBidderId),
          asset.currentPriceCents
        ]
      );
      return readByAssetId(asset.id);
    },

    async ensureForSoldAssets(assets) {
      const items: DealFollowupRecord[] = [];
      for (const asset of assets) {
        const followup = await this.ensureForSoldAsset(asset);
        if (followup) {
          items.push(followup);
        }
      }
      return items;
    },

    async findById(id) {
      return readById(id);
    },

    async listForBuyer(userId, input = {}) {
      return list({ ...input, buyerId: userId });
    },

    async listForAdmin(input = {}) {
      return list(input);
    },

    async updateBuyerStatus(id, buyerId, status) {
      return updateStatus(id, status, { buyerId });
    },

    async updateAdminStatus(id, status: AdminDealFollowupStatus, note) {
      return updateStatus(id, status, { note });
    },

  };
}
