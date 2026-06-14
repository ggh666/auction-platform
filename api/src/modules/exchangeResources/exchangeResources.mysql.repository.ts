import type { DragonBallInfo, ExchangeResource, ExchangeResourceStatus, UserSummary } from "@auction/shared";
import type { MysqlPool, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString } from "../../db/mysqlTypes";
import type {
  ExchangeResourceAdminListInput,
  CreateExchangeResourceInput,
  ExchangeResourceListInput,
  ExchangeResourcePageInput,
  ExchangeResourcesRepository
} from "./exchangeResources.repository";

type ExchangeResourceDbRow = {
  id: number;
  publisher_id: number;
  publisher_display_name: string;
  publisher_avatar_url: string | null;
  publisher_banned_at: Date | string | null;
  publisher_violation_count: number;
  publisher_credit_score: number;
  publisher_credit_reset_at: Date | string | null;
  publisher_buyer_unreachable_count: number;
  publisher_bid_restricted_until: Date | string | null;
  publisher_bid_restricted_permanent: boolean;
  publisher_bid_restriction_reason: string | null;
  publisher_bid_restriction_started_at: Date | string | null;
  game_name: string;
  server_name: string;
  title: string;
  dragon_ball_element: DragonBallInfo["element"];
  dragon_ball_profession: DragonBallInfo["profession"];
  dragon_ball_quality: DragonBallInfo["quality"];
  dragon_ball_attributes: string;
  dragon_ball_amount_cents: number | string | null;
  image_object_key: string;
  image_url: string;
  image_mime_type: string;
  image_size_bytes: number | string;
  desired_exchange: string;
  description: string;
  status: ExchangeResourceStatus;
  expires_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

const resourceSelect = `
  SELECT
    r.id,
    r.publisher_id,
    u.display_name AS publisher_display_name,
    u.avatar_url AS publisher_avatar_url,
    u.banned_at AS publisher_banned_at,
    u.violation_count AS publisher_violation_count,
    u.credit_score AS publisher_credit_score,
    u.credit_reset_at AS publisher_credit_reset_at,
    u.buyer_unreachable_count AS publisher_buyer_unreachable_count,
    u.bid_restricted_until AS publisher_bid_restricted_until,
    u.bid_restricted_permanent AS publisher_bid_restricted_permanent,
    u.bid_restriction_reason AS publisher_bid_restriction_reason,
    u.bid_restriction_started_at AS publisher_bid_restriction_started_at,
    r.game_name,
    r.server_name,
    r.title,
    r.dragon_ball_element,
    r.dragon_ball_profession,
    r.dragon_ball_quality,
    r.dragon_ball_attributes,
    r.dragon_ball_amount_cents,
    r.image_object_key,
    r.image_url,
    r.image_mime_type,
    r.image_size_bytes,
    r.desired_exchange,
    r.description,
    r.status,
    r.expires_at,
    r.created_at,
    r.updated_at
  FROM exchange_resources r
  JOIN users u ON u.id = r.publisher_id
`;

function publisherFromRow(row: ExchangeResourceDbRow): UserSummary {
  return {
    id: String(row.publisher_id),
    displayName: row.publisher_display_name,
    avatarUrl: row.publisher_avatar_url ?? undefined,
    banned: row.publisher_banned_at !== null,
    violationCount: row.publisher_violation_count,
    creditScore: row.publisher_credit_score,
    creditResetAt: row.publisher_credit_reset_at === null ? null : toIsoString(row.publisher_credit_reset_at),
    buyerUnreachableCount: row.publisher_buyer_unreachable_count,
    bidRestrictedUntil: row.publisher_bid_restricted_until === null ? null : toIsoString(row.publisher_bid_restricted_until),
    bidRestrictionPermanent: row.publisher_bid_restricted_permanent,
    bidRestrictionReason: row.publisher_bid_restriction_reason,
    bidRestrictionStartedAt:
      row.publisher_bid_restriction_started_at === null ? null : toIsoString(row.publisher_bid_restriction_started_at)
  };
}

function toResource(row: ExchangeResourceDbRow): ExchangeResource {
  return {
    id: String(row.id),
    publisherId: String(row.publisher_id),
    publisher: publisherFromRow(row),
    gameName: row.game_name,
    serverName: row.server_name,
    assetType: "道具",
    itemCategory: "龙珠",
    dragonBall: {
      element: row.dragon_ball_element,
      profession: row.dragon_ball_profession,
      quality: row.dragon_ball_quality,
      attributes: row.dragon_ball_attributes
    },
    dragonBallAmountCents: row.dragon_ball_amount_cents === null ? null : Number(row.dragon_ball_amount_cents),
    title: row.title,
    imageObjectKey: row.image_object_key,
    imageUrl: row.image_url,
    imageMimeType: row.image_mime_type,
    imageSizeBytes: Number(row.image_size_bytes),
    desiredExchange: row.desired_exchange,
    description: row.description,
    status: row.status,
    expiresAt: toIsoString(row.expires_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function normalizePage(input: ExchangeResourcePageInput = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

function activeWhere(input: ExchangeResourceListInput = {}) {
  const where = ["r.status = 'active'", "r.expires_at > CURRENT_TIMESTAMP"];
  const params: unknown[] = [];
  if (input.gameName?.trim()) {
    where.push("r.game_name = ?");
    params.push(input.gameName.trim());
  }
  if (input.dragonBallProfession?.trim()) {
    where.push("r.dragon_ball_profession = ?");
    params.push(input.dragonBallProfession.trim());
  }
  if (input.dragonBallQuality?.trim()) {
    where.push("r.dragon_ball_quality = ?");
    params.push(input.dragonBallQuality.trim());
  }
  const keyword = input.keyword?.trim();
  if (keyword) {
    where.push("(r.title LIKE ? OR r.server_name LIKE ? OR r.desired_exchange LIKE ? OR r.description LIKE ?)");
    const like = `%${keyword}%`;
    params.push(like, like, like, like);
  }
  return { where: `WHERE ${where.join(" AND ")}`, params };
}

function adminWhere(input: ExchangeResourceAdminListInput = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (input.status) {
    where.push("r.status = ?");
    params.push(input.status);
  }
  if (input.gameName?.trim()) {
    where.push("r.game_name = ?");
    params.push(input.gameName.trim());
  }
  if (input.dragonBallProfession?.trim()) {
    where.push("r.dragon_ball_profession = ?");
    params.push(input.dragonBallProfession.trim());
  }
  if (input.dragonBallQuality?.trim()) {
    where.push("r.dragon_ball_quality = ?");
    params.push(input.dragonBallQuality.trim());
  }
  const keyword = input.keyword?.trim();
  if (keyword) {
    where.push("(r.title LIKE ? OR r.server_name LIKE ? OR r.desired_exchange LIKE ? OR r.description LIKE ? OR u.display_name LIKE ?)");
    const like = `%${keyword}%`;
    params.push(like, like, like, like, like);
  }
  return { where: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "", params };
}

export function createMysqlExchangeResourcesRepository(pool: MysqlPool): ExchangeResourcesRepository {
  async function expireBeforeDate(now: Date) {
    await pool.execute<MysqlResultHeader>(
      `UPDATE exchange_resources
       SET status = 'expired'
       WHERE status IN ('active', 'pending_image_review') AND expires_at <= ?`,
      [now]
    );
  }

  async function listResources(where: string, params: unknown[], input: ExchangeResourcePageInput = {}) {
    const { page, pageSize } = normalizePage(input);
    const [countRows] = await pool.execute<Array<{ total: number | string }>>(
      `SELECT COUNT(*) AS total
       FROM exchange_resources r
       JOIN users u ON u.id = r.publisher_id
       ${where}`,
      params
    );
    const total = Number(firstRow<{ total: number | string }>(countRows)?.total ?? 0);
    const [rows] = await pool.execute<ExchangeResourceDbRow[]>(
      `${resourceSelect}
       ${where}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return {
      items: allRows<ExchangeResourceDbRow>(rows).map(toResource),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total
    };
  }

  async function readById(id: string): Promise<ExchangeResource | null> {
    const [rows] = await pool.execute<ExchangeResourceDbRow[]>(`${resourceSelect} WHERE r.id = ? LIMIT 1`, [Number(id)]);
    const row = firstRow<ExchangeResourceDbRow>(rows);
    return row ? toResource(row) : null;
  }

  return {
    async create(input: CreateExchangeResourceInput) {
      const [result] = await pool.execute<MysqlResultHeader>(
        `INSERT INTO exchange_resources (
           publisher_id,
           game_name,
           server_name,
           title,
           dragon_ball_element,
           dragon_ball_profession,
           dragon_ball_quality,
           dragon_ball_attributes,
           dragon_ball_amount_cents,
           image_object_key,
           image_url,
           image_mime_type,
           image_size_bytes,
           desired_exchange,
           description,
           status,
           expires_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(input.publisher.id),
          input.gameName,
          input.serverName,
          input.title,
          input.dragonBall.element,
          input.dragonBall.profession,
          input.dragonBall.quality,
          input.dragonBall.attributes,
          input.dragonBallAmountCents,
          input.image.objectKey,
          input.image.publicUrl,
          input.image.mimeType,
          input.image.sizeBytes,
          input.desiredExchange,
          input.description,
          input.status,
          input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ]
      );
      const created = await readById(String(result.insertId));
      if (!created) {
        throw new Error("Exchange resource could not be read");
      }
      return created;
    },

    async listActive(input = {}) {
      await expireBeforeDate(new Date());
      const { where, params } = activeWhere(input);
      return listResources(where, params, input);
    },

    async listForAdmin(input = {}) {
      await expireBeforeDate(new Date());
      const { where, params } = adminWhere(input);
      return listResources(where, params, input);
    },

    async listByPublisher(publisherId, input = {}) {
      await expireBeforeDate(new Date());
      return listResources("WHERE r.publisher_id = ?", [Number(publisherId)], input);
    },

    async listPendingImageReview() {
      await expireBeforeDate(new Date());
      const [rows] = await pool.execute<ExchangeResourceDbRow[]>(
        `${resourceSelect}
         WHERE r.status = 'pending_image_review'
         ORDER BY r.created_at DESC, r.id DESC`
      );
      return allRows<ExchangeResourceDbRow>(rows).map(toResource);
    },

    async findById(id) {
      await expireBeforeDate(new Date());
      return readById(id);
    },

    async activateImageReviewed(id) {
      await pool.execute<MysqlResultHeader>(
        `UPDATE exchange_resources
         SET status = 'active'
         WHERE id = ? AND status = 'pending_image_review' AND expires_at > CURRENT_TIMESTAMP`,
        [Number(id)]
      );
    },

    async expireDue() {
      await expireBeforeDate(new Date());
    },

    async closeByPublisher(id, publisherId) {
      const existing = await readById(id);
      if (!existing || existing.publisherId !== publisherId) {
        return null;
      }
      await pool.execute<MysqlResultHeader>(
        `UPDATE exchange_resources
         SET status = 'closed'
         WHERE id = ? AND publisher_id = ? AND status NOT IN ('removed', 'expired')`,
        [Number(id), Number(publisherId)]
      );
      return readById(id);
    }
  };
}
