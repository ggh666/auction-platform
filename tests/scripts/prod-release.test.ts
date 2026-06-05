import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(import.meta.dirname, "../../scripts/prod-release.sh");

describe("production release script guards", () => {
  it("verifies the release in a staging directory before stopping the running API", () => {
    const result = spawnSync("bash", [scriptPath, "--dry-run"], {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        ARCHIVE_PATH: resolve(projectRoot, "package.json"),
        APP_DIR: "/tmp/auction-platform-src",
        ADMIN_WEB_DIR: "/tmp/auction-admin",
        BACKUP_DIR: "/tmp/auction-backups",
        ENV_FILE: "/tmp/auction-api.env",
        NGINX_CONF: "/tmp/auction-platform.conf",
        DEPLOY_ADMIN: "false"
      }
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(output).toContain("/tmp/auction-platform-src.staging.");
    expect(output).toContain("npm ci --include=optional");
    expect(output.indexOf("systemctl stop auction-api")).toBeGreaterThan(output.indexOf("npm test"));
    expect(output.indexOf("Would verify API runtime executable in /tmp/auction-platform-src.staging.")).toBeGreaterThan(
      output.indexOf("chown -R auction-api:auction-api /tmp/auction-platform-src.staging.")
    );
    expect(output.indexOf("systemctl stop auction-api")).toBeGreaterThan(
      output.indexOf("Would verify API runtime executable in /tmp/auction-platform-src.staging.")
    );
    expect(output.indexOf("Verifying active app directory contents: /tmp/auction-platform-src")).toBeGreaterThan(
      output.indexOf("mv /tmp/auction-platform-src.staging.")
    );
    expect(output.indexOf("Verifying auction-api runtime cwd is /tmp/auction-platform-src")).toBeGreaterThan(
      output.indexOf("curl -fsS http://127.0.0.1:3002/health")
    );
    expect(output).toContain("DEPLOY_ADMIN=false; verifying existing admin static deployment before skipping rebuild.");
    expect(output).toContain("Verifying deployed admin static assets: /tmp/auction-admin");
  });

  it("rejects archives that do not contain current admin asset copy and deadline features", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("admin/src/App.tsx");
    expect(script).toContain("admin/src/pages/AssetDataPage.tsx");
    expect(script).toContain("admin/src/pages/AssetPublishPage.tsx");
    expect(script).toContain("admin/src/pages/AssetDetailPage.tsx");
    expect(script).toContain("api/src/modules/admin/admin.routes.ts");
    expect(script).toContain("shared/src/api-contracts.ts");

    expect(script).toContain("admin/src/App.tsx::copy-draft");
    expect(script).toContain("admin/src/pages/AssetDataPage.tsx::onCopyAsset");
    expect(script).toContain("admin/src/pages/AssetDataPage.tsx::复制中");
    expect(script).toContain("admin/src/pages/AssetPublishPage.tsx::copyDraft");
    expect(script).toContain("admin/src/pages/AssetPublishPage.tsx::复制资产");
    expect(script).toContain("admin/src/pages/AssetDetailPage.tsx::修改截止时间");
    expect(script).toContain("api/src/modules/admin/admin.routes.ts::/admin/assets/:assetId/copy-draft");
    expect(script).toContain("api/src/modules/admin/admin.routes.ts::/admin/assets/:assetId/end-time");
    expect(script).toContain("shared/src/api-contracts.ts::AdminAssetCopyDraft");
  });

  it("rejects archives that do not contain current public asset filter features", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("api/src/db/migrations/017_public_asset_dragon_filters_index.sql");
    expect(script).toContain("api/src/modules/assets/assets.routes.ts");
    expect(script).toContain("api/src/modules/assets/assets.repository.ts");
    expect(script).toContain("api/src/modules/assets/assets.mysql.repository.ts");
    expect(script).toContain("miniapp/api/client.ts");
    expect(script).toContain("miniapp/pages/auctions/list.vue");

    expect(script).toContain("api/src/db/migrations/017_public_asset_dragon_filters_index.sql::idx_assets_public_dragon_filters");
    expect(script).toContain("api/src/modules/assets/assets.routes.ts::dragonBallProfessionQuery");
    expect(script).toContain("api/src/modules/assets/assets.routes.ts::principalId: principalIdQuery");
    expect(script).toContain("api/src/modules/assets/assets.mysql.repository.ts::dragon_ball_profession = ?");
    expect(script).toContain("api/src/modules/assets/assets.repository.ts::dragonBallQuality");
    expect(script).toContain("miniapp/api/client.ts::listPrincipals");
    expect(script).toContain("miniapp/pages/auctions/list.vue::filter-panel");
    expect(script).toContain("miniapp/pages/auctions/list.vue::筛选主理人");
    expect(script).toContain("miniapp/pages/auctions/list.vue::dragonBallProfession");
  });

  it("verifies deployed admin static assets after copying them to nginx web root", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("verify_admin_static_contents");
    expect(script).toContain("verify_admin_static_or_fail");
    expect(script).toContain("verify_api_runtime_executable");
    expect(script).toContain("API runtime executable is missing or not executable");
    expect(script).toContain("Admin static deployment is missing marker");
    expect(script).toContain("copy-draft");
    expect(script).toContain("复制资产");
    expect(script).toContain("修改截止时间");
    expect(script).toMatch(/verify_admin_static_contents\s*$/m);
    expect(script).toMatch(/verify_admin_static_or_fail\s*$/m);
  });
});
