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
});
