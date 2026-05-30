import type { AdminRole, AuctionAsset } from "@auction/shared";
import { describe, expect, it } from "vitest";
import { createMysqlAdminRepository } from "../../api/src/modules/admin/admin.mysql.repository";
import { createMysqlAssetFollowsRepository } from "../../api/src/modules/assetFollows/assetFollows.mysql.repository";
import { createMysqlAssetsRepository } from "../../api/src/modules/assets/assets.mysql.repository";
import { createMysqlBidsRepository } from "../../api/src/modules/bids/bids.mysql.repository";
import { createMysqlSystemConfigsRepository } from "../../api/src/modules/configs/configs.mysql.repository";
import { createMysqlImageSafetyRepository } from "../../api/src/modules/contentSafety/imageSafety.mysql.repository";
import { createMysqlNotificationsRepository } from "../../api/src/modules/notifications/notifications.mysql.repository";
import { createMysqlReportsService } from "../../api/src/modules/reports/reports.mysql.service";
import { createMysqlUsersRepository } from "../../api/src/modules/users/users.mysql.repository";

type FakeUser = {
  id: number;
  openid: string | null;
  display_name: string;
  avatar_url: string | null;
  banned_at: Date | null;
  ban_reason: string | null;
  violation_count: number;
  credit_score: number;
  credit_reset_at: Date | null;
  daily_publish_limit: number | null;
  created_at: Date;
  updated_at: Date;
};

type FakeAsset = {
  id: number;
  seller_id: number;
  principal_id: number | null;
  game_name: string;
  server_name: string;
  asset_type: string;
  item_category: string | null;
  dragon_ball_profession: string | null;
  dragon_ball_quality: string | null;
  dragon_ball_attributes: string | null;
  title: string;
  description: string;
  status: string;
  starting_price_cents: number;
  current_price_cents: number | null;
  min_increment_cents: number;
  highest_bidder_id: number | null;
  original_end_at: Date;
  effective_end_at: Date;
  created_at: Date;
  updated_at: Date;
};

type FakeBid = {
  id: number;
  asset_id: number;
  bidder_id: number;
  amount_cents: number;
  created_at: Date;
};

type FakeImage = {
  id: number;
  asset_id: number;
  uploader_id: number;
  object_key: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
};

type FakeImageSafety = {
  uploader_id: number;
  object_key: string;
  public_url: string;
  status: "pending" | "pass" | "review" | "risky" | "failed";
  trace_id: string | null;
  label: number | null;
  detail_json: string | null;
  created_at: Date;
  updated_at: Date;
};

type FakeNotification = {
  id: number;
  user_id: number;
  type: "outbid";
  asset_id: number;
  bid_id: number;
  actor_user_id: number;
  actor_display_name: string;
  asset_title: string;
  amount_cents: number;
  read_at: Date | null;
  created_at: Date;
};

type FakeAssetFollow = {
  user_id: number;
  asset_id: number;
  created_at: Date;
};

type FakeReport = {
  id: number;
  reporter_id: number;
  target_user_id: number;
  asset_id: number | null;
  reason: string;
  evidence: string;
  status: "pending" | "rejected" | "confirmed";
  reviewed_by: number | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
};

type FakeSystemConfig = {
  config_key: string;
  config_value: string;
  updated_by: number | null;
  updated_at: Date;
};

type FakeAdminUser = {
  id: number;
  username: string;
  password_hash: string;
  role: AdminRole;
  disabled_at: Date | null;
};

class FakeMysqlConnection {
  beginCount = 0;
  commitCount = 0;
  rollbackCount = 0;
  releaseCount = 0;

  constructor(private readonly pool: FakeMysqlPool) {}

  async beginTransaction() {
    this.beginCount++;
  }

  async commit() {
    this.commitCount++;
  }

  async rollback() {
    this.rollbackCount++;
  }

  release() {
    this.releaseCount++;
  }

  async execute<T>(sql: string, params: unknown[] = []) {
    return this.pool.execute<T>(sql, params);
  }
}

class FakeMysqlPool {
  users: FakeUser[] = [];
  assets: FakeAsset[] = [];
  bids: FakeBid[] = [];
  follows: FakeAssetFollow[] = [];
  notifications: FakeNotification[] = [];
  reports: FakeReport[] = [];
  images: FakeImage[] = [];
  imageSafety: FakeImageSafety[] = [];
  configs: FakeSystemConfig[] = [];
  adminUsers: FakeAdminUser[] = [];
  adminLogs: Array<{ admin_id: number; action: string; target_type: string; target_id: number; detail_json: string | null }> = [];
  lastConnection: FakeMysqlConnection | null = null;

  private resetExpiredCreditScores(userId?: number) {
    const now = new Date("2026-05-25T14:00:00.000Z").getTime();
    for (const user of this.users) {
      if (userId !== undefined && user.id !== userId) {
        continue;
      }
      if (user.credit_score < 100 && user.credit_reset_at && user.credit_reset_at.getTime() <= now) {
        user.credit_score = 100;
        user.credit_reset_at = null;
        user.updated_at = new Date("2026-05-25T14:00:00.000Z");
      }
    }
  }

  private filterAdminAssets(sql: string, params: unknown[]) {
    let cursor = 0;
    let filtered = [...this.assets];
    if (sql.includes("id = ? OR seller_id = ?")) {
      const idKeyword = Number(params[cursor++]);
      const sellerKeyword = Number(params[cursor++]);
      const titleKeyword = String(params[cursor++]).replaceAll("%", "");
      filtered = filtered.filter(
        (asset) =>
          asset.id === idKeyword ||
          asset.seller_id === sellerKeyword ||
          asset.title.includes(titleKeyword)
      );
    } else if (sql.includes("title LIKE ?")) {
      const titleKeyword = String(params[cursor++]).replaceAll("%", "");
      filtered = filtered.filter((asset) => asset.title.includes(titleKeyword));
    }
    if (sql.includes("status = ?")) {
      const status = params[cursor++];
      filtered = filtered.filter((asset) => asset.status === status);
    } else if (sql.includes("status IN")) {
      const statuses = new Set(params.slice(cursor, cursor + 2));
      cursor += 2;
      filtered = filtered.filter((asset) => statuses.has(asset.status));
    }
    if (sql.includes("game_name = ?")) {
      const gameName = params[cursor++];
      filtered = filtered.filter((asset) => asset.game_name === gameName);
    }
    if (sql.includes("asset_type = ?")) {
      const assetType = params[cursor++];
      filtered = filtered.filter((asset) => asset.asset_type === assetType);
    }
    return filtered.sort((left, right) => right.created_at.getTime() - left.created_at.getTime() || right.id - left.id);
  }

  private filterPublicAssets(sql: string, params: unknown[]) {
    let cursor = 0;
    let filtered = this.assets.filter((asset) => asset.status === "active");
    if (sql.includes("effective_end_at > ?")) {
      const nowMs = new Date(params[cursor++] as Date | string).getTime();
      filtered = filtered.filter((asset) => asset.effective_end_at.getTime() > nowMs);
    }
    if (sql.includes("created_at >= ?")) {
      const sinceMs = new Date(params[cursor++] as Date | string).getTime();
      filtered = filtered.filter((asset) => asset.created_at.getTime() >= sinceMs);
    }
    if (sql.includes("game_name = ?")) {
      const gameName = params[cursor++];
      filtered = filtered.filter((asset) => asset.game_name === gameName);
    }
    if (sql.includes("asset_type IN")) {
      const assetTypes = new Set([params[cursor++], params[cursor++]]);
      filtered = filtered.filter((asset) => assetTypes.has(asset.asset_type));
    } else if (sql.includes("asset_type = ?")) {
      const assetType = params[cursor++];
      filtered = filtered.filter((asset) => asset.asset_type === assetType);
    }
    if (sql.includes("title LIKE")) {
      const titleKeyword = String(params[cursor++]).replaceAll("%", "");
      const serverKeyword = String(params[cursor++]).replaceAll("%", "");
      const descriptionKeyword = String(params[cursor++]).replaceAll("%", "");
      filtered = filtered.filter(
        (asset) =>
          asset.title.includes(titleKeyword) ||
          asset.server_name.includes(serverKeyword) ||
          asset.description.includes(descriptionKeyword)
      );
    }
    return filtered.sort(
      (left, right) =>
        left.effective_end_at.getTime() - right.effective_end_at.getTime() ||
        right.created_at.getTime() - left.created_at.getTime() ||
        right.id - left.id
    );
  }

  async getConnection() {
    this.lastConnection = new FakeMysqlConnection(this);
    return this.lastConnection;
  }

  async execute<T>(sql: string, params: unknown[] = []): Promise<[T, unknown[]]> {
    if (sql.includes("INSERT INTO users")) {
      const openid = params[0] as string | null;
      const displayName = params[1] as string;
      const avatarUrl = (params[2] as string | null | undefined) ?? null;
      const existing = openid ? this.users.find((user) => user.openid === openid) : null;
      if (existing) {
        existing.display_name = displayName;
        existing.avatar_url = avatarUrl ?? existing.avatar_url;
        return [{ insertId: existing.id, affectedRows: 2 } as T, []];
      }

      const user: FakeUser = {
        id: this.users.length + 1,
        openid,
        display_name: displayName,
        avatar_url: avatarUrl,
        banned_at: null,
        ban_reason: null,
        violation_count: 0,
        credit_score: 100,
        credit_reset_at: null,
        daily_publish_limit: null,
        created_at: new Date("2026-05-25T00:00:00.000Z"),
        updated_at: new Date("2026-05-25T00:00:00.000Z")
      };
      this.users.push(user);
      return [{ insertId: user.id, affectedRows: 1 } as T, []];
    }

    if (sql.includes("UPDATE users") && sql.includes("credit_score = 100")) {
      const userId = sql.includes("WHERE id = ?") ? Number(params[0]) : undefined;
      this.resetExpiredCreditScores(userId);
      return [{ affectedRows: 0, insertId: 0 } as T, []];
    }

    if (sql.includes("UPDATE users") && sql.includes("credit_score = GREATEST")) {
      const user = this.users.find((candidate) => candidate.id === Number(params[1]));
      if (user) {
        user.violation_count += 1;
        user.credit_score = Math.max(0, user.credit_score - Number(params[0]));
        user.credit_reset_at = new Date("2026-08-25T14:00:00.000Z");
        user.updated_at = new Date("2026-05-25T14:00:00.000Z");
      }
      return [{ affectedRows: user ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("UPDATE users") && sql.includes("banned_at = CURRENT_TIMESTAMP")) {
      const user = this.users.find((candidate) => candidate.id === Number(params[1]));
      if (user) {
        user.banned_at = new Date("2026-05-25T14:00:00.000Z");
        user.ban_reason = params[0] as string;
        user.updated_at = new Date("2026-05-25T14:00:00.000Z");
      }
      return [{ affectedRows: user ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("UPDATE users") && sql.includes("banned_at = NULL")) {
      const user = this.users.find((candidate) => candidate.id === Number(params[0]));
      if (user) {
        user.banned_at = null;
        user.ban_reason = null;
        user.updated_at = new Date("2026-05-25T14:10:00.000Z");
      }
      return [{ affectedRows: user ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("UPDATE users") && sql.includes("daily_publish_limit")) {
      const user = this.users.find((candidate) => candidate.id === Number(params[1]));
      if (user) {
        user.daily_publish_limit = params[0] === null ? null : Number(params[0]);
        user.updated_at = new Date("2026-05-25T14:20:00.000Z");
      }
      return [{ affectedRows: user ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM users") && sql.includes("banned_at IS NOT NULL")) {
      return [[{ total: this.users.filter((user) => user.banned_at !== null).length }] as T, []];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM users") && sql.includes("created_at >= ?")) {
      const sinceMs = new Date(params[0] as Date | string).getTime();
      return [[{ total: this.users.filter((user) => user.created_at.getTime() >= sinceMs).length }] as T, []];
    }

    if (sql.includes("FROM users") && sql.includes("WHERE openid")) {
      return [[this.users.find((user) => user.openid === params[0])].filter(Boolean) as T, []];
    }

    if (sql.includes("FROM users") && sql.includes("display_name LIKE")) {
      const hasIdSearch = sql.includes("id = ? OR display_name LIKE");
      const query = String(params[hasIdSearch ? 1 : 0]).replace(/%/g, "");
      const idQuery = hasIdSearch ? Number(params[0]) : null;
      const filtered = this.users.filter((user) => user.display_name.includes(query) || (idQuery !== null && user.id === idQuery));
      if (sql.includes("COUNT(*) AS total")) {
        return [[{ total: filtered.length }] as T, []];
      }
      return [
        filtered.sort((left, right) => right.created_at.getTime() - left.created_at.getTime() || right.id - left.id) as T,
        []
      ];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM users")) {
      return [[{ total: this.users.length }] as T, []];
    }

    if (sql.includes("FROM users") && sql.includes("ORDER BY created_at")) {
      return [
        [...this.users].sort((left, right) => right.created_at.getTime() - left.created_at.getTime() || right.id - left.id) as T,
        []
      ];
    }

    if (sql.includes("FROM users") && sql.includes("WHERE id =")) {
      return [[this.users.find((user) => user.id === Number(params[0]))].filter(Boolean) as T, []];
    }

    if (sql.includes("UPDATE system_configs")) {
      const config = this.configs.find((candidate) => candidate.config_key === params[2]);
      if (config) {
        config.config_value = params[0] as string;
        config.updated_by = Number(params[1]);
        config.updated_at = new Date("2026-05-25T15:00:00.000Z");
      }
      return [{ affectedRows: config ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("FROM system_configs") && sql.includes("WHERE config_key")) {
      return [[this.configs.find((config) => config.config_key === params[0])].filter(Boolean) as T, []];
    }

    if (sql.includes("FROM system_configs")) {
      return [[...this.configs].sort((left, right) => left.config_key.localeCompare(right.config_key)) as T, []];
    }

    if (sql.includes("INSERT INTO admin_users")) {
      const admin: FakeAdminUser = {
        id: this.adminUsers.length + 1,
        username: params[0] as string,
        password_hash: params[1] as string,
        role: params[2] as AdminRole,
        disabled_at: null
      };
      this.adminUsers.push(admin);
      return [{ insertId: admin.id, affectedRows: 1 } as T, []];
    }

    if (sql.includes("UPDATE admin_users") && sql.includes("SET username =")) {
      const admin = this.adminUsers.find((candidate) => candidate.id === Number(params[4]));
      if (admin) {
        admin.username = params[0] as string;
        admin.password_hash = params[1] as string;
        admin.role = params[2] as AdminRole;
        admin.disabled_at = (params[3] as Date | null) ?? null;
      }
      return [{ affectedRows: admin ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("UPDATE admin_users") && sql.includes("disabled_at = COALESCE")) {
      const admin = this.adminUsers.find((candidate) => candidate.id === Number(params[0]));
      if (admin) {
        admin.disabled_at = admin.disabled_at ?? new Date("2026-05-25T16:00:00.000Z");
      }
      return [{ affectedRows: admin ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("FROM admin_users") && sql.includes("WHERE id =")) {
      return [[this.adminUsers.find((admin) => admin.id === Number(params[0]))].filter(Boolean) as T, []];
    }

    if (sql.includes("FROM admin_users") && sql.includes("WHERE username =")) {
      return [[this.adminUsers.find((admin) => admin.username === params[0])].filter(Boolean) as T, []];
    }

    if (sql.includes("FROM admin_users") && sql.includes("ORDER BY id ASC")) {
      return [[...this.adminUsers].sort((left, right) => left.id - right.id) as T, []];
    }

    if (sql.includes("INSERT INTO admin_operation_logs")) {
      this.adminLogs.push({
        admin_id: Number(params[0]),
        action: params[1] as string,
        target_type: params[2] as string,
        target_id: Number(params[3]),
        detail_json: (params[4] as string | null) ?? null
      });
      return [{ insertId: this.adminLogs.length, affectedRows: 1 } as T, []];
    }

    if (sql.includes("INSERT INTO auction_assets")) {
      const asset: FakeAsset = {
        id: this.assets.length + 1,
        seller_id: Number(params[0]),
        principal_id: params[1] === null ? null : Number(params[1]),
        game_name: params[2] as string,
        server_name: params[3] as string,
        asset_type: params[4] as string,
        item_category: (params[5] as string | null) ?? null,
        dragon_ball_profession: (params[6] as string | null) ?? null,
        dragon_ball_quality: (params[7] as string | null) ?? null,
        dragon_ball_attributes: (params[8] as string | null) ?? null,
        title: params[9] as string,
        description: params[10] as string,
        status: "pending_review",
        starting_price_cents: Number(params[11]),
        current_price_cents: null,
        min_increment_cents: Number(params[12]),
        highest_bidder_id: null,
        original_end_at: params[13] as Date,
        effective_end_at: params[14] as Date,
        created_at: new Date("2026-05-25T00:00:00.000Z"),
        updated_at: new Date("2026-05-25T00:00:00.000Z")
      };
      this.assets.push(asset);
      return [{ insertId: asset.id, affectedRows: 1 } as T, []];
    }

    if (sql.includes("INSERT INTO asset_images")) {
      this.images.push({
        id: this.images.length + 1,
        asset_id: Number(params[0]),
        uploader_id: Number(params[1]),
        object_key: params[2] as string,
        public_url: params[3] as string,
        mime_type: params[4] as string,
        size_bytes: Number(params[5]),
        sort_order: Number(params[6])
      });
      return [{ insertId: this.images.length, affectedRows: 1 } as T, []];
    }

    if (sql.includes("FROM asset_images")) {
      return [
        this.images
          .filter((image) => image.asset_id === Number(params[0]))
          .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)
          .map((image) => ({ public_url: image.public_url })) as T,
        []
      ];
    }

    if (sql.includes("INSERT INTO asset_follows")) {
      const userId = Number(params[0]);
      const assetId = Number(params[1]);
      const existing = this.follows.find((follow) => follow.user_id === userId && follow.asset_id === assetId);
      if (!existing) {
        this.follows.push({
          user_id: userId,
          asset_id: assetId,
          created_at: new Date(`2026-05-25T16:${String(this.follows.length).padStart(2, "0")}:00.000Z`)
        });
      }
      return [{ insertId: 0, affectedRows: existing ? 0 : 1 } as T, []];
    }

    if (sql.includes("DELETE FROM asset_follows")) {
      const before = this.follows.length;
      this.follows = this.follows.filter(
        (follow) => !(follow.user_id === Number(params[0]) && follow.asset_id === Number(params[1]))
      );
      return [{ insertId: 0, affectedRows: before - this.follows.length } as T, []];
    }

    if (sql.includes("FROM asset_follows") && sql.includes("WHERE user_id = ? AND asset_id = ?")) {
      return [
        [
          this.follows.find((follow) => follow.user_id === Number(params[0]) && follow.asset_id === Number(params[1]))
        ].filter(Boolean) as T,
        []
      ];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM asset_follows")) {
      return [[{ total: this.follows.filter((follow) => follow.user_id === Number(params[0])).length }] as T, []];
    }

    if (sql.includes("FROM asset_follows") && sql.includes("asset_id IN")) {
      const userId = Number(params[0]);
      const assetIds = new Set(params.slice(1).map(Number));
      return [this.follows.filter((follow) => follow.user_id === userId && assetIds.has(follow.asset_id)) as T, []];
    }

    if (sql.includes("FROM asset_follows") && sql.includes("ORDER BY created_at DESC")) {
      const userId = Number(params[0]);
      const limit = Number(params[1]);
      const offset = Number(params[2]);
      return [
        this.follows
          .filter((follow) => follow.user_id === userId)
          .sort((left, right) => right.created_at.getTime() - left.created_at.getTime() || right.asset_id - left.asset_id)
          .slice(offset, offset + limit) as T,
        []
      ];
    }

    if (sql.includes("INSERT INTO content_safety_image_checks")) {
      const publicUrl = params[2] as string;
      const existing = this.imageSafety.find((record) => record.public_url === publicUrl);
      if (existing) {
        existing.status = params[3] as FakeImageSafety["status"];
        existing.trace_id = (params[4] as string | null) ?? null;
        existing.label = (params[5] as number | null) ?? null;
        existing.detail_json = (params[6] as string | null) ?? null;
        existing.updated_at = new Date("2026-05-25T15:10:00.000Z");
      } else {
        this.imageSafety.push({
          uploader_id: Number(params[0]),
          object_key: params[1] as string,
          public_url: publicUrl,
          status: params[3] as FakeImageSafety["status"],
          trace_id: (params[4] as string | null) ?? null,
          label: (params[5] as number | null) ?? null,
          detail_json: (params[6] as string | null) ?? null,
          created_at: new Date("2026-05-25T15:05:00.000Z"),
          updated_at: new Date("2026-05-25T15:05:00.000Z")
        });
      }
      return [{ insertId: this.imageSafety.length, affectedRows: existing ? 2 : 1 } as T, []];
    }

    if (sql.includes("FROM content_safety_image_checks") && sql.includes("WHERE public_url =")) {
      return [[this.imageSafety.find((record) => record.public_url === params[0])].filter(Boolean) as T, []];
    }

    if (sql.includes("FROM content_safety_image_checks") && sql.includes("WHERE public_url IN")) {
      const publicUrls = new Set(params as string[]);
      return [this.imageSafety.filter((record) => publicUrls.has(record.public_url)) as T, []];
    }

    if (sql.includes("UPDATE content_safety_image_checks")) {
      const record = this.imageSafety.find((candidate) => candidate.trace_id === params[3]);
      if (record) {
        record.status = params[0] as FakeImageSafety["status"];
        record.label = (params[1] as number | null) ?? null;
        record.detail_json = (params[2] as string | null) ?? null;
        record.updated_at = new Date("2026-05-25T15:15:00.000Z");
      }
      return [{ affectedRows: record ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("INSERT INTO station_notifications")) {
      const notification: FakeNotification = {
        id: this.notifications.length + 1,
        user_id: Number(params[0]),
        type: params[1] as "outbid",
        asset_id: Number(params[2]),
        bid_id: Number(params[3]),
        actor_user_id: Number(params[4]),
        actor_display_name: params[5] as string,
        asset_title: params[6] as string,
        amount_cents: Number(params[7]),
        read_at: null,
        created_at: new Date("2026-05-25T15:55:00.000Z")
      };
      this.notifications.push(notification);
      return [{ insertId: notification.id, affectedRows: 1 } as T, []];
    }

    if (sql.includes("UPDATE station_notifications")) {
      const notification = this.notifications.find(
        (candidate) => candidate.id === Number(params[0]) && candidate.user_id === Number(params[1])
      );
      if (notification && notification.read_at === null) {
        notification.read_at = new Date("2026-05-25T16:00:00.000Z");
      }
      return [{ insertId: 0, affectedRows: notification ? 1 : 0 } as T, []];
    }

    if (sql.includes("FROM station_notifications") && sql.includes("WHERE id =")) {
      return [[this.notifications.find((notification) => notification.id === Number(params[0]))].filter(Boolean) as T, []];
    }

    if (sql.includes("FROM station_notifications") && sql.includes("WHERE user_id =")) {
      return [
        this.notifications
          .filter((notification) => notification.user_id === Number(params[0]))
          .sort((left, right) => right.created_at.getTime() - left.created_at.getTime() || right.id - left.id)
          .slice(0, Number(params[1])) as T,
        []
      ];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("seller_id = ?") && sql.includes("created_at >= ?")) {
      const sellerId = Number(params[0]);
      const sinceMs = new Date(params[1] as Date | string).getTime();
      return [
        [
          {
            total: this.assets.filter(
              (asset) => asset.seller_id === sellerId && asset.created_at.getTime() >= sinceMs
            ).length
          }
        ] as T,
        []
      ];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM auction_assets") && sql.includes("status = 'active'")) {
      return [[{ total: this.filterPublicAssets(sql, params).length }] as T, []];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM auction_assets") && sql.includes("status = 'pending_review'")) {
      const filtered = this.assets.filter(
        (asset) =>
          asset.status === "pending_review" &&
          (!sql.includes("principal_id = ?") || asset.principal_id === Number(params[0]))
      );
      return [[{ total: filtered.length }] as T, []];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM auction_assets") && sql.includes("created_at >= ?")) {
      const sinceMs = new Date(params[0] as Date | string).getTime();
      return [[{ total: this.assets.filter((asset) => asset.created_at.getTime() >= sinceMs).length }] as T, []];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM auction_assets")) {
      return [[{ total: this.filterAdminAssets(sql, params).length }] as T, []];
    }

    if (
      sql.includes("FROM auction_assets") &&
      sql.includes("status = 'active'") &&
      sql.includes("ORDER BY effective_end_at") &&
      sql.includes("LIMIT ? OFFSET ?")
    ) {
      const limit = Number(params.at(-2));
      const offset = Number(params.at(-1));
      const rows = this.filterPublicAssets(sql, params).slice(offset, offset + limit);
      return [rows as T, []];
    }

    if (sql.includes("FROM auction_assets") && sql.includes("status = 'pending_review'") && sql.includes("LIMIT ? OFFSET ?")) {
      const limit = Number(params.at(-2));
      const offset = Number(params.at(-1));
      const rows = this.assets
        .filter(
          (asset) =>
            asset.status === "pending_review" &&
            (!sql.includes("principal_id = ?") || asset.principal_id === Number(params[0]))
        )
        .sort((left, right) => left.created_at.getTime() - right.created_at.getTime() || left.id - right.id)
        .slice(offset, offset + limit);
      return [rows as T, []];
    }

    if (sql.includes("FROM auction_assets") && sql.includes("LIMIT ? OFFSET ?")) {
      const limit = Number(params.at(-2));
      const offset = Number(params.at(-1));
      const rows = this.filterAdminAssets(sql, params).slice(offset, offset + limit);
      return [rows as T, []];
    }

    if (sql.includes("UPDATE auction_assets") && sql.includes("SET status = 'active'")) {
      const asset = this.assets.find((candidate) => candidate.id === Number(params[1]));
      if (asset && asset.status === "pending_review") {
        asset.status = "active";
        asset.effective_end_at = params[0] as Date;
        asset.updated_at = new Date("2026-05-25T13:00:00.000Z");
      }
      return [{ affectedRows: asset ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("UPDATE auction_assets") && sql.includes("status = 'rejected'")) {
      const asset = this.assets.find((candidate) => candidate.id === Number(params[1]));
      if (asset && asset.status === "pending_review") {
        asset.status = "rejected";
        asset.updated_at = new Date("2026-05-25T13:00:00.000Z");
      }
      return [{ affectedRows: asset ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("FROM auction_assets") && sql.includes("status = 'pending_review'")) {
      return [this.assets.filter((asset) => asset.status === "pending_review") as T, []];
    }

    if (sql.includes("FROM auction_assets") && sql.includes("status = 'active'") && sql.includes("ORDER BY effective_end_at")) {
      return [this.filterPublicAssets(sql, params) as T, []];
    }

    if (sql.includes("FROM auction_assets") && sql.includes("seller_id = ? OR highest_bidder_id = ?")) {
      const userId = Number(params[0]);
      return [this.assets.filter((asset) => asset.seller_id === userId || asset.highest_bidder_id === userId) as T, []];
    }

    if (sql.includes("FROM auction_assets") && sql.includes("seller_id = ?")) {
      return [this.assets.filter((asset) => asset.seller_id === Number(params[0])) as T, []];
    }

    if (sql.includes("FROM auction_assets")) {
      return [[this.assets.find((asset) => asset.id === Number(params[0]))].filter(Boolean) as T, []];
    }

    if (sql.includes("INSERT INTO bids")) {
      const bid: FakeBid = {
        id: this.bids.length + 1,
        asset_id: Number(params[0]),
        bidder_id: Number(params[1]),
        amount_cents: Number(params[2]),
        created_at: new Date("2026-05-25T12:00:00.000Z")
      };
      this.bids.push(bid);
      return [{ insertId: bid.id, affectedRows: 1 } as T, []];
    }

    if (sql.includes("UPDATE auction_assets")) {
      const asset = this.assets.find((candidate) => candidate.id === Number(params[3]));
      if (asset) {
        asset.current_price_cents = Number(params[0]);
        asset.highest_bidder_id = Number(params[1]);
        asset.effective_end_at = params[2] as Date;
      }
      return [{ affectedRows: asset ? 1 : 0, insertId: 0 } as T, []];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM bids") && sql.includes("created_at >= ?")) {
      const sinceMs = new Date(params[0] as Date | string).getTime();
      return [[{ total: this.bids.filter((bid) => bid.created_at.getTime() >= sinceMs).length }] as T, []];
    }

    if (sql.includes("FROM bids") && sql.includes("bidder_id =")) {
      return [this.bids.filter((bid) => bid.bidder_id === Number(params[0])) as T, []];
    }

    if (sql.includes("FROM bids") && sql.includes("asset_id =")) {
      return [this.bids.filter((bid) => bid.asset_id === Number(params[0])) as T, []];
    }

    if (sql.includes("FROM bids") && sql.includes("id =")) {
      return [[this.bids.find((bid) => bid.id === Number(params[0]))].filter(Boolean) as T, []];
    }

    if (sql.includes("COUNT(*) AS total") && sql.includes("FROM reports") && sql.includes("status = ?")) {
      return [[{ total: this.reports.filter((report) => report.status === params[0]).length }] as T, []];
    }

    if (sql.includes("FROM reports") && sql.includes("WHERE id =")) {
      return [[this.reports.find((report) => report.id === Number(params[0]))].filter(Boolean) as T, []];
    }

    if (sql.includes("FROM reports")) {
      return [[...this.reports].sort((left, right) => right.created_at.getTime() - left.created_at.getTime() || right.id - left.id) as T, []];
    }

    if (sql.includes("UPDATE reports") && sql.includes("status = 'rejected'")) {
      const report = this.reports.find((candidate) => candidate.id === Number(params[2]));
      if (report) {
        report.status = "rejected";
        report.reviewed_by = Number(params[0]);
        report.review_note = (params[1] as string | null) ?? null;
        report.reviewed_at = new Date("2026-05-25T13:30:00.000Z");
      }
      return [{ affectedRows: report ? 1 : 0, insertId: 0 } as T, []];
    }

    throw new Error(`Unhandled SQL in fake pool: ${sql}`);
  }
}

function activeAsset(): AuctionAsset {
  const now = "2026-05-25T00:00:00.000Z";
  return {
    id: "1",
    sellerId: "1",
    principalId: null,
    gameName: "梦幻西游",
    serverName: "测试区",
    assetType: "角色",
    title: "69级角色",
    description: "展示用资产",
    imageUrls: [],
    status: "active",
    startingPriceCents: 10000,
    currentPriceCents: null,
    minIncrementCents: 100,
    highestBidderId: null,
    originalEndAt: "2026-05-26T00:00:00.000Z",
    effectiveEndAt: "2026-05-26T00:00:00.000Z",
    createdAt: now,
    updatedAt: now
  };
}

function createFixtureTimeMysqlBidsRepository(pool: FakeMysqlPool) {
  return createMysqlBidsRepository(pool, { now: () => new Date("2026-05-25T23:50:00.000Z") });
}

function activeAssetRow(): FakeAsset {
  return {
    id: 1,
    seller_id: 1,
    principal_id: null,
    game_name: "梦幻西游",
    server_name: "测试区",
    asset_type: "角色",
    item_category: null,
    dragon_ball_profession: null,
    dragon_ball_quality: null,
    dragon_ball_attributes: null,
    title: "69级角色",
    description: "展示用资产",
    status: "active",
    starting_price_cents: 10000,
    current_price_cents: null,
    min_increment_cents: 100,
    highest_bidder_id: null,
    original_end_at: new Date("2026-05-26T00:00:00.000Z"),
    effective_end_at: new Date("2026-05-26T00:00:00.000Z"),
    created_at: new Date("2026-05-25T00:00:00.000Z"),
    updated_at: new Date("2026-05-25T00:00:00.000Z")
  };
}

function pendingAssetRow(id = 1): FakeAsset {
  return { ...activeAssetRow(), id, status: "pending_review", title: `待审核资产${id}` };
}

function pendingReportRow(id = 1): FakeReport {
  return {
    id,
    reporter_id: 1,
    target_user_id: 2,
    asset_id: 1,
    reason: "资料不完整",
    evidence: "截图",
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    created_at: new Date("2026-05-25T00:00:00.000Z")
  };
}

describe("mysql repositories", () => {
  it("upserts WeChat users by openid", async () => {
    const pool = new FakeMysqlPool();
    const users = createMysqlUsersRepository(pool);

    const created = await users.findOrCreateWechatUser({
      openid: "openid-1",
      displayName: "第一次昵称",
      avatarUrl: "https://example.com/a.png"
    });
    const updated = await users.findOrCreateWechatUser({
      openid: "openid-1",
      displayName: "第二次昵称"
    });

    expect(created.id).toBe(1);
    expect(updated).toMatchObject({
      id: 1,
      openid: "openid-1",
      display_name: "第二次昵称",
      avatar_url: "https://example.com/a.png"
    });
    expect(pool.users).toHaveLength(1);
  });

  it("lists, bans, and unbans users from MySQL rows", async () => {
    const pool = new FakeMysqlPool();
    const users = createMysqlUsersRepository(pool);

    await users.findOrCreateWechatUser({ openid: "openid-1", displayName: "普通卖家" });
    const target = await users.findOrCreateWechatUser({ openid: "openid-2", displayName: "目标买家" });

    const listed = await users.listForAdmin({ query: "目标" });
    const banned = await users.banUser(target.id, "线下交易违约");
    const unbanned = await users.unbanUser(target.id);

    expect(listed).toEqual([expect.objectContaining({ id: target.id, display_name: "目标买家" })]);
    expect(banned).toMatchObject({ id: target.id, ban_reason: "线下交易违约" });
    expect(banned.banned_at).toBeInstanceOf(Date);
    expect(unbanned).toMatchObject({ id: target.id, banned_at: null, ban_reason: null });
  });

  it("sets and clears user daily publish limits in MySQL rows", async () => {
    const pool = new FakeMysqlPool();
    const users = createMysqlUsersRepository(pool);
    const user = await users.findOrCreateWechatUser({ openid: "openid-1", displayName: "普通卖家" });

    const limited = await (users as any).setDailyPublishLimit(user.id, 7);
    const cleared = await (users as any).setDailyPublishLimit(user.id, null);

    expect(limited).toMatchObject({ id: user.id, daily_publish_limit: 7 });
    expect(cleared).toMatchObject({ id: user.id, daily_publish_limit: null });
  });

  it("deducts MySQL user credit score and records a reset time", async () => {
    const pool = new FakeMysqlPool();
    const users = createMysqlUsersRepository(pool);
    const user = await users.findOrCreateWechatUser({ openid: "openid-1", displayName: "普通卖家" });

    const deducted = await users.deductCreditScore(user.id, 5);

    expect(deducted).toMatchObject({
      id: user.id,
      violation_count: 1,
      credit_score: 95
    });
    expect(deducted.credit_reset_at).toBeInstanceOf(Date);
  });

  it("counts user dashboard metrics from MySQL rows", async () => {
    const pool = new FakeMysqlPool();
    pool.users.push(
      {
        id: 1,
        openid: "openid-1",
        display_name: "普通卖家",
        avatar_url: null,
        banned_at: null,
        ban_reason: null,
        violation_count: 0,
        credit_score: 100,
        credit_reset_at: null,
        daily_publish_limit: null,
        created_at: new Date("2026-05-25T00:00:00.000Z"),
        updated_at: new Date("2026-05-25T00:00:00.000Z")
      },
      {
        id: 2,
        openid: "openid-2",
        display_name: "封禁买家",
        avatar_url: null,
        banned_at: new Date("2026-05-25T02:00:00.000Z"),
        ban_reason: "测试",
        violation_count: 0,
        credit_score: 100,
        credit_reset_at: null,
        daily_publish_limit: null,
        created_at: new Date("2026-05-24T23:59:59.000Z"),
        updated_at: new Date("2026-05-25T02:00:00.000Z")
      }
    );
    const users = createMysqlUsersRepository(pool);

    await expect((users as any).countAll()).resolves.toBe(2);
    await expect((users as any).countBanned()).resolves.toBe(1);
    await expect((users as any).countCreatedSince("2026-05-25T00:00:00.000Z")).resolves.toBe(1);
  });

  it("lists and updates system configs from MySQL rows", async () => {
    const pool = new FakeMysqlPool();
    pool.configs.push(
      {
        config_key: "default_min_increment_cents",
        config_value: "100",
        updated_by: null,
        updated_at: new Date("2026-05-25T00:00:00.000Z")
      },
      {
        config_key: "max_images_per_asset",
        config_value: "9",
        updated_by: null,
        updated_at: new Date("2026-05-25T00:00:00.000Z")
      }
    );
    const configs = createMysqlSystemConfigsRepository(pool);

    const listed = await configs.list();
    const updated = await configs.update("default_min_increment_cents", "200", 3);

    expect(listed).toEqual([
      expect.objectContaining({ key: "default_min_increment_cents", value: "100" }),
      expect.objectContaining({ key: "max_images_per_asset", value: "9" })
    ]);
    expect(updated).toMatchObject({
      key: "default_min_increment_cents",
      value: "200",
      updatedBy: 3,
      updatedAt: "2026-05-25T15:00:00.000Z"
    });
  });

  it("persists admin operation logs", async () => {
    const pool = new FakeMysqlPool();
    const admins = createMysqlAdminRepository(pool);

    await admins.logOperation({
      adminId: 1,
      action: "asset.approve",
      targetType: "asset",
      targetId: "42",
      detail: { status: "active" }
    });

    expect(pool.adminLogs).toEqual([
      {
        admin_id: 1,
        action: "asset.approve",
        target_type: "asset",
        target_id: 42,
        detail_json: JSON.stringify({ status: "active" })
      }
    ]);
  });

  it("sets MySQL pending assets to end 24 hours after approval", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push({ ...pendingAssetRow(1), original_end_at: new Date("2099-12-31T15:59:59.000Z"), effective_end_at: new Date("2099-12-31T15:59:59.000Z") });
    const assets = createMysqlAssetsRepository(pool);
    const beforeApprove = Date.now();

    const approved = await assets.approvePending("1");
    const afterApprove = Date.now();
    const effectiveEndAt = new Date(approved.effectiveEndAt).getTime();

    expect(approved.status).toBe("active");
    expect(effectiveEndAt).toBeGreaterThanOrEqual(beforeApprove + 24 * 60 * 60 * 1000);
    expect(effectiveEndAt).toBeLessThanOrEqual(afterApprove + 24 * 60 * 60 * 1000);
    expect(pool.assets[0].original_end_at.toISOString()).toBe("2099-12-31T15:59:59.000Z");
  });

  it("creates updates and soft deletes admin users from MySQL rows", async () => {
    const pool = new FakeMysqlPool();
    const admins = createMysqlAdminRepository(pool);

    const created = await admins.create({ username: "principal-a", passwordHash: "hash-1", role: "reviewer" });
    const updated = await admins.update(created.id, { username: "principal-b", passwordHash: "hash-2", role: "operator" });
    const deleted = await admins.softDelete(created.id);
    const listed = await admins.list();

    expect(created).toMatchObject({ id: 1, username: "principal-a", password_hash: "hash-1", role: "reviewer" });
    expect(updated).toMatchObject({ id: 1, username: "principal-b", password_hash: "hash-2", role: "operator" });
    expect(deleted.disabled_at).toBeInstanceOf(Date);
    expect(listed).toEqual([expect.objectContaining({ id: 1, username: "principal-b", disabled_at: expect.any(Date) })]);
    await expect(admins.findByUsername("principal-b")).resolves.toMatchObject({ id: 1, role: "operator" });
  });

  it("lists and rejects pending assets from MySQL rows", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push(pendingAssetRow(1), { ...pendingAssetRow(2), status: "active" });
    const assets = createMysqlAssetsRepository(pool);

    const pending = await assets.listPendingReview();
    const rejected = await assets.rejectPending("1", "截图不完整");

    expect(pending).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [expect.objectContaining({ id: "1", status: "pending_review" })]
    });
    expect(rejected).toMatchObject({ id: "1", status: "rejected" });
    expect(pool.assets[0].status).toBe("rejected");
  });

  it("lists admin asset rows from MySQL with filters and pagination", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push(
      { ...pendingAssetRow(1), game_name: "塔防精灵", asset_type: "账号", title: "待审核账号" },
      { ...activeAssetRow(), id: 2, seller_id: 2, game_name: "塔防精灵", asset_type: "账号", title: "塔防账号一" },
      { ...activeAssetRow(), id: 3, seller_id: 3, game_name: "塔防精灵", asset_type: "账号", title: "塔防账号二" },
      { ...activeAssetRow(), id: 4, seller_id: 4, game_name: "塔防精灵", asset_type: "道具", title: "塔防道具" }
    );
    const assets = createMysqlAssetsRepository(pool);

    const result = await assets.listForAdmin({
      status: "active",
      gameName: "塔防精灵",
      assetType: "账号",
      page: 1,
      pageSize: 1
    });

    expect(result).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 1,
      items: [expect.objectContaining({ id: "3", status: "active", gameName: "塔防精灵", assetType: "账号" })]
    });
  });

  it("defaults MySQL admin asset rows to active and pending review by newest created time", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push(
      {
        ...pendingAssetRow(1),
        title: "较早待审核",
        created_at: new Date("2026-05-25T09:00:00.000Z")
      },
      {
        ...activeAssetRow(),
        id: 2,
        title: "已上架",
        status: "active",
        created_at: new Date("2026-05-25T10:00:00.000Z")
      },
      {
        ...activeAssetRow(),
        id: 3,
        title: "已结束",
        status: "ended",
        created_at: new Date("2026-05-25T12:00:00.000Z")
      },
      {
        ...pendingAssetRow(4),
        title: "最新待审核",
        created_at: new Date("2026-05-25T13:00:00.000Z")
      },
      {
        ...activeAssetRow(),
        id: 5,
        title: "已下架",
        status: "removed",
        created_at: new Date("2026-05-25T14:00:00.000Z")
      }
    );
    const assets = createMysqlAssetsRepository(pool);

    const result = await assets.listForAdmin();

    expect(result).toMatchObject({
      total: 3,
      items: [
        expect.objectContaining({ id: "4", status: "pending_review" }),
        expect.objectContaining({ id: "2", status: "active" }),
        expect.objectContaining({ id: "1", status: "pending_review" })
      ]
    });
  });

  it("lists legacy equipment rows in the public prop list from MySQL", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push(
      { ...activeAssetRow(), id: 1, seller_id: 1, game_name: "塔防精灵", asset_type: "装备", title: "历史装备" },
      { ...activeAssetRow(), id: 2, seller_id: 2, game_name: "塔防精灵", asset_type: "账号", title: "塔防账号" }
    );
    const assets = createMysqlAssetsRepository(pool);

    const result = await assets.listActive({ gameName: "塔防精灵", assetType: "道具" });

    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [expect.objectContaining({ id: "1", title: "历史装备" })]
    });
  });

  it("filters and paginates public asset rows from MySQL", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push(
      {
        ...activeAssetRow(),
        id: 1,
        seller_id: 1,
        game_name: "塔防精灵",
        asset_type: "账号",
        title: "旧账号",
        created_at: new Date("2026-05-01T00:00:00.000Z"),
        effective_end_at: new Date("2026-05-30T00:00:00.000Z")
      },
      {
        ...activeAssetRow(),
        id: 2,
        seller_id: 2,
        game_name: "塔防精灵",
        asset_type: "账号",
        title: "新账号一",
        created_at: new Date("2026-05-25T00:00:00.000Z"),
        effective_end_at: new Date("2026-05-30T00:00:00.000Z")
      },
      {
        ...activeAssetRow(),
        id: 3,
        seller_id: 3,
        game_name: "塔防精灵",
        asset_type: "账号",
        title: "新账号二",
        created_at: new Date("2026-05-26T00:00:00.000Z"),
        effective_end_at: new Date("2026-05-30T00:00:00.000Z")
      }
    );
    const assets = createMysqlAssetsRepository(pool);

    const list = await assets.listActive({
      gameName: "塔防精灵",
      assetType: "账号",
      createdSince: "2026-05-20T00:00:00.000Z",
      nowIso: "2026-05-27T00:00:00.000Z",
      page: 2,
      pageSize: 1
    });
    const search = await assets.listActive({
      gameName: "塔防精灵",
      assetType: "账号",
      keyword: "旧",
      createdSince: "2026-04-01T00:00:00.000Z",
      nowIso: "2026-05-27T00:00:00.000Z"
    });

    expect(list).toMatchObject({
      total: 2,
      page: 2,
      pageSize: 1,
      items: [expect.objectContaining({ id: "2", title: "新账号一" })]
    });
    expect(search).toMatchObject({
      total: 1,
      items: [expect.objectContaining({ id: "1", title: "旧账号" })]
    });
  });

  it("counts assets created by a seller since a timestamp", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push(
      { ...pendingAssetRow(1), seller_id: 1, created_at: new Date("2026-05-24T23:59:59.000Z") },
      { ...pendingAssetRow(2), seller_id: 1, created_at: new Date("2026-05-25T00:00:00.000Z") },
      { ...pendingAssetRow(3), seller_id: 2, created_at: new Date("2026-05-25T01:00:00.000Z") }
    );
    const assets = createMysqlAssetsRepository(pool);

    const count = await (assets as any).countCreatedBySellerSince("1", "2026-05-25T00:00:00.000Z");

    expect(count).toBe(1);
  });

  it("counts asset, bid, and report dashboard metrics from MySQL rows", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push(
      { ...pendingAssetRow(1), status: "pending_review", created_at: new Date("2026-05-24T23:59:59.000Z") },
      { ...pendingAssetRow(2), status: "active", created_at: new Date("2026-05-25T01:00:00.000Z") }
    );
    pool.bids.push(
      { id: 1, asset_id: 2, bidder_id: 2, amount_cents: 10000, created_at: new Date("2026-05-25T02:00:00.000Z") },
      { id: 2, asset_id: 2, bidder_id: 3, amount_cents: 10100, created_at: new Date("2026-05-24T23:59:59.000Z") }
    );
    pool.reports.push(
      pendingReportRow(1),
      { ...pendingReportRow(2), status: "confirmed", reviewed_by: 1, reviewed_at: new Date("2026-05-25T03:00:00.000Z") }
    );
    const assets = createMysqlAssetsRepository(pool);
    const bids = createMysqlBidsRepository(pool);
    const reports = createMysqlReportsService(pool);

    await expect((assets as any).countByStatus("pending_review")).resolves.toBe(1);
    await expect((assets as any).countCreatedSince("2026-05-25T00:00:00.000Z")).resolves.toBe(1);
    await expect((bids as any).countCreatedSince("2026-05-25T00:00:00.000Z")).resolves.toBe(1);
    await expect((reports as any).countByStatus("pending")).resolves.toBe(1);
  });

  it("creates Dragon Ball assets with attached image rows in MySQL", async () => {
    const pool = new FakeMysqlPool();
    const assets = createMysqlAssetsRepository(pool);

    const asset = await assets.createPending({
      sellerId: "1",
      gameName: "梦幻西游",
      serverName: "测试区",
      assetType: "道具",
      itemCategory: "龙珠",
      dragonBall: {
        element: "暗",
        profession: "战士",
        quality: "金",
        attributes: "附加伤害+10%，无视冰甲+5%"
      },
      title: "带图龙珠",
      description: "展示用资产",
      startingPriceCents: 10000,
      minIncrementCents: 100,
      originalEndAt: "2026-05-26T00:00:00.000Z",
      images: [
        {
          objectKey: "uploads/1/a.png",
          publicUrl: "https://img.example.com/uploads/1/a.png",
          mimeType: "image/png",
          sizeBytes: 8
        }
      ]
    });

    expect(asset.imageUrls).toEqual(["https://img.example.com/uploads/1/a.png"]);
    expect(asset).toMatchObject({
      assetType: "道具",
      itemCategory: "龙珠",
      dragonBall: {
        element: "暗",
        profession: "战士",
        quality: "金",
        attributes: "附加伤害+10%，无视冰甲+5%"
      }
    });
    expect(pool.images).toEqual([
      expect.objectContaining({
        asset_id: 1,
        uploader_id: 1,
        object_key: "uploads/1/a.png",
        sort_order: 0
      })
    ]);
  });

  it("stores, lists, checks, and removes asset follows in MySQL", async () => {
    const pool = new FakeMysqlPool();
    const follows = createMysqlAssetFollowsRepository(pool);

    await follows.follow("2", "10");
    await follows.follow("2", "11");
    await follows.follow("2", "10");

    const followedIds = await follows.listFollowedAssetIdsIn("2", ["10", "12"]);
    const firstPage = await follows.listByUser("2", { page: 1, pageSize: 1 });
    const secondPage = await follows.listByUser("2", { page: 2, pageSize: 1 });

    expect(pool.follows).toHaveLength(2);
    expect([...followedIds]).toEqual(["10"]);
    expect(firstPage).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(firstPage.items).toEqual([expect.objectContaining({ userId: "2", assetId: "11" })]);
    expect(secondPage.items).toEqual([expect.objectContaining({ userId: "2", assetId: "10" })]);

    await follows.unfollow("2", "10");

    await expect(follows.listFollowedAssetIdsIn("2", ["10", "11"])).resolves.toEqual(new Set(["11"]));
  });

  it("records and updates image content safety rows in MySQL", async () => {
    const pool = new FakeMysqlPool();
    const imageSafety = createMysqlImageSafetyRepository(pool);

    const created = await imageSafety.record({
      userId: "1",
      objectKey: "uploads/1/a.png",
      publicUrl: "https://img.example.com/uploads/1/a.png",
      status: "pending",
      traceId: "trace-1"
    });
    await imageSafety.updateByTraceId({
      traceId: "trace-1",
      status: "pass",
      label: 100,
      detailJson: [{ strategy: "content_model", suggest: "pass" }]
    });
    const listed = await imageSafety.findByPublicUrls(["https://img.example.com/uploads/1/a.png"]);

    expect(created).toMatchObject({
      userId: "1",
      objectKey: "uploads/1/a.png",
      publicUrl: "https://img.example.com/uploads/1/a.png",
      status: "pending",
      traceId: "trace-1"
    });
    expect(listed).toEqual([
      expect.objectContaining({
        status: "pass",
        traceId: "trace-1",
        label: 100,
        detailJson: [{ strategy: "content_model", suggest: "pass" }],
        updatedAt: "2026-05-25T15:15:00.000Z"
      })
    ]);
  });

  it("lists profile asset and result rows from MySQL assets", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push(
      pendingAssetRow(1),
      { ...activeAssetRow(), id: 2, seller_id: 2, title: "其他人的资产" },
      { ...activeAssetRow(), id: 3, seller_id: 1, current_price_cents: 12000, highest_bidder_id: 2 }
    );
    const assets = createMysqlAssetsRepository(pool);

    const published = await assets.listBySeller("1");
    const relatedResults = await assets.listRelatedResults("2");

    expect(published.map((asset) => asset.id)).toEqual(["1", "3"]);
    expect(relatedResults).toEqual([expect.objectContaining({ id: "3", currentPriceCents: 12000 })]);
  });

  it("rejects reports in the MySQL reports service", async () => {
    const pool = new FakeMysqlPool();
    pool.reports.push(pendingReportRow());
    const reports = createMysqlReportsService(pool);

    const rejected = await reports.rejectReport("1", 7, "证据不足");

    expect(rejected).toMatchObject({
      id: "1",
      status: "rejected",
      confirmedByAdminId: 7
    });
    expect(pool.reports[0]).toMatchObject({
      status: "rejected",
      reviewed_by: 7,
      review_note: "证据不足"
    });
  });

  it("creates bids and updates assets inside one transaction", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push(activeAssetRow());
    const bids = createFixtureTimeMysqlBidsRepository(pool);

    const result = await bids.createBid({
      asset: activeAsset(),
      bidderId: "2",
      amountCents: 10000,
      effectiveEndAt: "2026-05-26T00:05:00.000Z"
    });

    expect(pool.lastConnection?.beginCount).toBe(1);
    expect(pool.lastConnection?.commitCount).toBe(1);
    expect(pool.lastConnection?.rollbackCount).toBe(0);
    expect(pool.lastConnection?.releaseCount).toBe(1);
    expect(result.bid).toMatchObject({ id: "1", assetId: "1", bidderId: "2", amountCents: 10000 });
    expect(result.asset).toMatchObject({
      id: "1",
      currentPriceCents: 10000,
      highestBidderId: "2",
      effectiveEndAt: "2026-05-26T00:05:00.000Z"
    });
  });

  it("returns updated current price from MySQL public asset rows after bidding", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push({ ...activeAssetRow(), game_name: "塔防精灵", asset_type: "账号" });
    const bids = createFixtureTimeMysqlBidsRepository(pool);
    const assets = createMysqlAssetsRepository(pool);

    await bids.createBid({
      asset: { ...activeAsset(), gameName: "塔防精灵", assetType: "账号" },
      bidderId: "2",
      amountCents: 12300,
      effectiveEndAt: "2026-05-26T00:05:00.000Z"
    });
    const result = await assets.listActive({
      gameName: "塔防精灵",
      assetType: "账号",
      nowIso: "2026-05-25T23:55:00.000Z"
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "1",
        startingPriceCents: 10000,
        currentPriceCents: 12300
      })
    ]);
  });

  it("lists bids by bidder from MySQL rows", async () => {
    const pool = new FakeMysqlPool();
    pool.bids.push(
      { id: 1, asset_id: 1, bidder_id: 2, amount_cents: 10000, created_at: new Date("2026-05-25T12:00:00.000Z") },
      { id: 2, asset_id: 2, bidder_id: 3, amount_cents: 12000, created_at: new Date("2026-05-25T12:10:00.000Z") }
    );
    const bids = createMysqlBidsRepository(pool);

    await expect(bids.listByBidder("2")).resolves.toEqual([
      expect.objectContaining({ id: "1", assetId: "1", bidderId: "2", amountCents: 10000 })
    ]);
  });

  it("rejects a bid if a locked asset row already has a higher current price", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push({ ...activeAssetRow(), current_price_cents: 10000, highest_bidder_id: 3 });
    const bids = createFixtureTimeMysqlBidsRepository(pool);

    await expect(
      bids.createBid({
        asset: activeAsset(),
        bidderId: "2",
        amountCents: 10050,
        effectiveEndAt: "2026-05-26T00:05:00.000Z"
      })
    ).rejects.toMatchObject({ code: "bid_too_low" });

    expect(pool.lastConnection?.beginCount).toBe(1);
    expect(pool.lastConnection?.commitCount).toBe(0);
    expect(pool.lastConnection?.rollbackCount).toBe(1);
    expect(pool.lastConnection?.releaseCount).toBe(1);
    expect(pool.bids).toHaveLength(0);
  });

  it("rejects a bid if the locked asset row already has the same highest bidder", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push({ ...activeAssetRow(), current_price_cents: 10000, highest_bidder_id: 2 });
    const bids = createFixtureTimeMysqlBidsRepository(pool);

    await expect(
      bids.createBid({
        asset: { ...activeAsset(), currentPriceCents: 10000, highestBidderId: "2" },
        bidderId: "2",
        amountCents: 10100,
        effectiveEndAt: "2026-05-26T00:05:00.000Z"
      })
    ).rejects.toMatchObject({ code: "bidder_already_highest" });

    expect(pool.lastConnection?.beginCount).toBe(1);
    expect(pool.lastConnection?.commitCount).toBe(0);
    expect(pool.lastConnection?.rollbackCount).toBe(1);
    expect(pool.lastConnection?.releaseCount).toBe(1);
    expect(pool.bids).toHaveLength(0);
  });

  it("rejects a bid if the locked asset row has already passed its effective end time", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push({ ...activeAssetRow(), effective_end_at: new Date(Date.now() - 1000) });
    const bids = createMysqlBidsRepository(pool);

    await expect(
      bids.createBid({
        asset: { ...activeAsset(), effectiveEndAt: new Date(Date.now() + 60_000).toISOString() },
        bidderId: "2",
        amountCents: 10000,
        effectiveEndAt: new Date(Date.now() + 60_000).toISOString()
      })
    ).rejects.toMatchObject({ code: "auction_ended" });

    expect(pool.lastConnection?.beginCount).toBe(1);
    expect(pool.lastConnection?.commitCount).toBe(0);
    expect(pool.lastConnection?.rollbackCount).toBe(1);
    expect(pool.lastConnection?.releaseCount).toBe(1);
    expect(pool.bids).toHaveLength(0);
  });

  it("does not shorten an auction that was already extended by another bid", async () => {
    const pool = new FakeMysqlPool();
    pool.assets.push({
      ...activeAssetRow(),
      current_price_cents: 10000,
      highest_bidder_id: 3,
      effective_end_at: new Date("2026-05-26T00:10:00.000Z")
    });
    const bids = createFixtureTimeMysqlBidsRepository(pool);

    const result = await bids.createBid({
      asset: { ...activeAsset(), currentPriceCents: 10000, effectiveEndAt: "2026-05-26T00:00:00.000Z" },
      bidderId: "2",
      amountCents: 10100,
      effectiveEndAt: "2026-05-26T00:05:00.000Z"
    });

    expect(result.asset).toMatchObject({
      currentPriceCents: 10100,
      highestBidderId: "2",
      effectiveEndAt: "2026-05-26T00:10:00.000Z"
    });
  });

  it("creates and reads station notifications from MySQL rows", async () => {
    const pool = new FakeMysqlPool();
    const notifications = createMysqlNotificationsRepository(pool);

    await notifications.createMany([
      {
        userId: "2",
        type: "outbid",
        assetId: "1",
        bidId: "5",
        actorUserId: "3",
        actorDisplayName: "买家二",
        assetTitle: "69级角色",
        amountCents: 10100
      }
    ]);
    const listed = await notifications.listByUser("2");
    const read = await notifications.markRead("2", listed[0].id);

    expect(listed).toEqual([
      expect.objectContaining({
        userId: "2",
        type: "outbid",
        actorDisplayName: "买家二",
        assetTitle: "69级角色",
        readAt: null
      })
    ]);
    expect(read?.readAt).toBe("2026-05-25T16:00:00.000Z");
  });
});
