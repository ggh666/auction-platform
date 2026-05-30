import { canBidAmount, type BidRecord } from "@auction/shared";
import { inTransaction } from "../../db/transaction";
import type { MysqlExecutor, MysqlPool, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString, toMysqlDate } from "../../db/mysqlTypes";
import { badRequest } from "../../http/errors";
import { toAuctionAsset, type AssetDbRow } from "../assets/assets.mysql.repository";
import type { BidsRepository, CreateBidInput } from "./bids.repository";

type BidDbRow = {
  id: number;
  asset_id: number;
  bidder_id: number;
  amount_cents: number;
  created_at: Date | string;
};

const bidSelect = `
  SELECT id, asset_id, bidder_id, amount_cents, created_at
  FROM bids
`;

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

function toBidRecord(row: BidDbRow): BidRecord {
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    bidderId: String(row.bidder_id),
    amountCents: Number(row.amount_cents),
    createdAt: toIsoString(row.created_at)
  };
}

function laterIsoString(left: string, right: string): string {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return rightTime > leftTime ? right : left;
}

async function readBid(db: MysqlExecutor, id: number): Promise<BidRecord> {
  const [rows] = await db.execute<BidDbRow[]>(`${bidSelect} WHERE id = ? LIMIT 1`, [id]);
  const row = firstRow<BidDbRow>(rows);
  if (!row) {
    throw new Error("Created bid could not be read");
  }
  return toBidRecord(row);
}

async function readAsset(db: MysqlExecutor, id: string) {
  const [rows] = await db.execute<AssetDbRow[]>(`${assetSelect} WHERE id = ? LIMIT 1`, [Number(id)]);
  const row = firstRow<AssetDbRow>(rows);
  if (!row) {
    throw new Error("Asset not found");
  }
  return toAuctionAsset(row);
}

async function lockAssetForBid(db: MysqlExecutor, id: string) {
  const [rows] = await db.execute<AssetDbRow[]>(`${assetSelect} WHERE id = ? LIMIT 1 FOR UPDATE`, [Number(id)]);
  const row = firstRow<AssetDbRow>(rows);
  if (!row) {
    throw new Error("Asset not found");
  }
  return toAuctionAsset(row);
}

export function createMysqlBidsRepository(pool: MysqlPool, options: { now?: () => Date } = {}): BidsRepository {
  const now = options.now ?? (() => new Date());

  return {
    async createBid(input: CreateBidInput) {
      return inTransaction(pool, async (connection) => {
        const lockedAsset = await lockAssetForBid(connection, input.asset.id);
        const lockedEnd = new Date(lockedAsset.effectiveEndAt);
        if (!Number.isFinite(lockedEnd.getTime()) || now().getTime() >= lockedEnd.getTime()) {
          throw badRequest("auction_ended", "Auction already ended");
        }
        if (lockedAsset.highestBidderId === input.bidderId) {
          throw badRequest("bidder_already_highest", "Current highest bidder cannot bid again");
        }
        if (
          !canBidAmount({
            amountCents: input.amountCents,
            startingPriceCents: lockedAsset.startingPriceCents,
            currentPriceCents: lockedAsset.currentPriceCents,
            minIncrementCents: lockedAsset.minIncrementCents
          })
        ) {
          throw badRequest("bid_too_low", "Bid does not satisfy current price and increment");
        }
        const effectiveEndAt = laterIsoString(lockedAsset.effectiveEndAt, input.effectiveEndAt);

        const [bidResult] = await connection.execute<MysqlResultHeader>(
          `INSERT INTO bids (asset_id, bidder_id, amount_cents)
           VALUES (?, ?, ?)`,
          [Number(input.asset.id), Number(input.bidderId), input.amountCents]
        );

        const [assetResult] = await connection.execute<MysqlResultHeader>(
          `UPDATE auction_assets
           SET current_price_cents = ?, highest_bidder_id = ?, effective_end_at = ?
           WHERE id = ?`,
          [input.amountCents, Number(input.bidderId), toMysqlDate(effectiveEndAt), Number(input.asset.id)]
        );
        if (assetResult.affectedRows === 0) {
          throw new Error("Asset not found");
        }

        const bid = await readBid(connection, bidResult.insertId);
        const asset = await readAsset(connection, input.asset.id);
        return { bid, asset };
      });
    },

    async countCreatedSince(since, input = {}) {
      const principalJoin = input.principalId ? " INNER JOIN auction_assets a ON a.id = b.asset_id" : "";
      const principalWhere = input.principalId ? " AND a.principal_id = ?" : "";
      const [rows] = await pool.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM bids b
         ${principalJoin}
         WHERE b.created_at >= ?${principalWhere}`,
        input.principalId ? [toMysqlDate(since), Number(input.principalId)] : [toMysqlDate(since)]
      );
      const row = firstRow<{ total: number | string }>(rows);
      return row ? Number(row.total) : 0;
    },

    async listByAsset(assetId) {
      const [rows] = await pool.execute<BidDbRow[]>(
        `${bidSelect}
         WHERE asset_id = ?
         ORDER BY created_at ASC`,
        [Number(assetId)]
      );
      return allRows<BidDbRow>(rows).map(toBidRecord);
    },

    async listByBidder(bidderId) {
      const [rows] = await pool.execute<BidDbRow[]>(
        `${bidSelect}
         WHERE bidder_id = ?
         ORDER BY created_at DESC`,
        [Number(bidderId)]
      );
      return allRows<BidDbRow>(rows).map(toBidRecord);
    }
  };
}
