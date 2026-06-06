import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(import.meta.dirname, "../../scripts/prod-release.sh");

describe("production release script guards", () => {
  it("keeps required release markers aligned with current source files", () => {
    const script = readFileSync(scriptPath, "utf8");
    const markerBlock = script.match(/required_release_markers=\([\s\S]*?\n\)/)?.[0] ?? "";
    const markers = Array.from(markerBlock.matchAll(/"([^"]+::[^"]+)"/g)).map((match) => match[1]);

    expect(markers.length).toBeGreaterThan(0);

    for (const marker of markers) {
      const [file, pattern] = marker.split("::");
      const sourcePath = resolve(projectRoot, file);

      expect(existsSync(sourcePath), `${marker} points to a missing file`).toBe(true);
      expect(readFileSync(sourcePath, "utf8"), marker).toContain(pattern);
    }
  });

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

  it("rejects archives that do not contain current user asset publishing features", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("api/src/db/migrations/013_user_asset_publish_switch.sql");
    expect(script).toContain("api/src/modules/auth/auth.routes.ts");
    expect(script).toContain("api/src/modules/configs/publishConfig.ts");
    expect(script).toContain("api/src/modules/images/images.routes.ts");
    expect(script).toContain("miniapp/pages/auctions/publish.vue");
    expect(script).toContain("miniapp/pages/profile/assets.vue");
    expect(script).toContain("miniapp/pages/profile/index.vue");
    expect(script).toContain("miniapp/utils/assetPublishCopy.ts");
    expect(script).toContain("admin/src/pages/ConfigPage.tsx");

    expect(script).toContain("api/src/db/migrations/013_user_asset_publish_switch.sql::user_asset_publish_enabled");
    expect(script).toContain("api/src/modules/auth/auth.routes.ts::/api/profile/assets");
    expect(script).toContain("api/src/modules/configs/publishConfig.ts::USER_ASSET_PUBLISH_ENABLED_KEY");
    expect(script).toContain("api/src/modules/images/images.routes.ts::asset_publish_disabled");
    expect(script).toContain("api/src/modules/images/images.routes.ts::openid: user.openid");
    expect(script).toContain("api/src/modules/assets/assets.routes.ts::/api/asset-publish-context");
    expect(script).toContain("api/src/modules/assets/assets.routes.ts::remainingDailyPublishCount");
    expect(script).toContain("shared/src/api-contracts.ts::AssetPublishContextResponse");
    expect(script).toContain("miniapp/api/client.ts::getAssetPublishContext");
    expect(script).toContain("miniapp/api/client.ts::listMyAssets");
    expect(script).toContain("miniapp/utils/assetPublishCopy.ts::USER_ASSET_SUBMIT_DISABLED_REASON");
    expect(script).toContain("miniapp/utils/assetPublishCopy.ts::normalizeUserAssetSubmitDisabledReason");
    expect(script).toContain("miniapp/pages.json::pages/profile/assets");
    expect(script).toContain("miniapp/pages.json::pages/auctions/publish");
    expect(script).toContain("miniapp/pages/auctions/publish.vue::提交审核");
    expect(script).toContain("miniapp/pages/auctions/publish.vue::请重新登录后上传");
    expect(script).toContain("miniapp/pages/profile/assets.vue::getAssetPublishContext");
    expect(script).toContain("miniapp/pages/profile/assets.vue::提交资产");
    expect(script).toContain("miniapp/pages/profile/index.vue::通知中心");
    expect(script).toContain("miniapp/pages/profile/index.vue::我的资产");
    expect(script).toContain("admin/src/pages/ConfigPage.tsx::user_asset_publish_enabled");
    expect(script).toContain("用户发布开关");
  });

  it("rejects archives that do not contain current asset conversation messaging features", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("api/src/db/migrations/018_asset_conversations.sql");
    expect(script).toContain("api/src/modules/assetConversations/assetConversations.routes.ts");
    expect(script).toContain("api/src/realtime/messageWsServer.ts");
    expect(script).toContain("shared/src/ws-events.ts");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue");
    expect(script).toContain("admin/src/pages/MessageCenterPage.tsx");

    expect(script).toContain("api/src/db/migrations/018_asset_conversations.sql::asset_conversations");
    expect(script).toContain("api/src/modules/assetConversations/assetConversations.routes.ts::/api/assets/:assetId/conversations/principal");
    expect(script).toContain("api/src/modules/assetConversations/assetConversations.routes.ts::/admin/asset-conversations");
    expect(script).toContain("api/src/realtime/messageWsServer.ts::/ws/messages");
    expect(script).toContain("shared/src/ws-events.ts::AssetMessageWsEvent");
    expect(script).toContain("miniapp/api/client.ts::createPrincipalConversation");
    expect(script).toContain("miniapp/pages/auctions/detail.vue::联系主理人");
    expect(script).toContain("miniapp/pages/auctions/detail.vue::principalContactState");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue::realtimeActive");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue::请输入消息内容");
    expect(script).toContain("admin/src/components/AppLayout.tsx::消息中心");
    expect(script).toContain("admin/src/pages/MessageCenterPage.tsx::发送消息");
  });

  it("checks that the running release script matches the archive before marker checks", () => {
    const script = readFileSync(scriptPath, "utf8");
    const validateConfigBlock = script.match(/validate_config\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(validateConfigBlock.indexOf("verify_release_script_matches_archive")).toBeLessThan(
      validateConfigBlock.indexOf("verify_archive_contents")
    );
  });

  it("reads full archive files during marker checks to avoid grep -q SIGPIPE failures", () => {
    const script = readFileSync(scriptPath, "utf8");
    const archiveFileContainsBlock = script.match(/archive_file_contains\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(archiveFileContainsBlock).toContain('grep -- "$2" >/dev/null');
    expect(archiveFileContainsBlock).not.toContain("grep -q");
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
    expect(script).toContain("user_asset_publish_enabled");
    expect(script).toContain("用户发布开关");
    expect(script).toMatch(/verify_admin_static_contents\s*$/m);
    expect(script).toMatch(/verify_admin_static_or_fail\s*$/m);
  });
});
