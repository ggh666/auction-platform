import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = new URL("../../api/src/db/migrations/", import.meta.url);

function readAllMigrations(): string {
  return readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => readFileSync(join(migrationsDir.pathname, fileName), "utf8"))
    .join("\n");
}

describe("SQL performance coverage", () => {
  it("keeps high-volume list and count queries backed by dedicated indexes", () => {
    const sql = readAllMigrations();

    expect(sql).toContain("idx_assets_active_end");
    expect(sql).toContain("idx_assets_public_filters");
    expect(sql).toContain("idx_assets_public_dragon_filters");
    expect(sql).toContain("idx_assets_status_created");
    expect(sql).toContain("idx_assets_created");
    expect(sql).toContain("idx_assets_principal_created");
    expect(sql).toContain("idx_assets_seller_updated");
    expect(sql).toContain("idx_assets_highest_bidder_updated");
    expect(sql).toContain("idx_bids_created");
    expect(sql).toContain("idx_users_created");
    expect(sql).toContain("idx_users_banned_at");
    expect(sql).toContain("idx_users_credit_reset");
    expect(sql).toContain("idx_reports_created");
    expect(sql).toContain("idx_violations_published");
    expect(sql).toContain("idx_violations_report");
  });

  it("does not wrap indexed search columns in functions in high-volume repositories", () => {
    const repositorySql = [
      "../../api/src/modules/assets/assets.mysql.repository.ts",
      "../../api/src/modules/users/users.mysql.repository.ts"
    ]
      .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
      .join("\n");

    expect(repositorySql).not.toMatch(/CAST\((id|seller_id) AS CHAR\)/);
    expect(repositorySql).not.toMatch(/LOWER\((title|server_name|description)\)/);
  });

  it("does not keep buyer contact collection schema or notification enums", () => {
    const sql = readAllMigrations();

    expect(sql).not.toMatch(/ADD COLUMN buyer_contact_/);
    expect(sql).not.toMatch(/buyer_contact_\w+\s+TEXT NULL/);
    expect(sql).not.toMatch(/buyer_contact_submitted_at\s+DATETIME NULL/);
    expect(sql).not.toMatch(/contact_notice_sent_at\s+DATETIME NULL/);
    expect(sql).not.toContain("ENUM('outbid','deal_contact_required')");
  });

  it("does not alter notification foreign key columns while removing contact reminders", () => {
    const migration = readFileSync(join(migrationsDir.pathname, "016_remove_deal_followup_contact_info.sql"), "utf8");

    expect(migration).toContain("DELETE FROM station_notifications WHERE type = 'deal_contact_required'");
    expect(migration).toContain("MODIFY COLUMN type ENUM('outbid') NOT NULL");
    expect(migration).not.toMatch(/MODIFY COLUMN\s+(bid_id|actor_user_id)\b/);
    expect(migration).not.toMatch(/MODIFY COLUMN\s+amount_cents\b/);
  });
});
