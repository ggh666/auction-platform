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
    expect(script).toContain("api/src/db/pool.ts");
    expect(script).toContain("api/src/observability/requestTiming.ts");
    expect(script).toContain("api/src/serverLifecycle.ts");
    expect(script).toContain("api/src/modules/images/images.routes.ts");
    expect(script).toContain("miniapp/pages/auctions/publish.vue");
    expect(script).toContain("miniapp/pages/profile/assets.vue");
    expect(script).toContain("miniapp/pages/profile/exchanges.vue");
    expect(script).toContain("miniapp/pages/profile/index.vue");
    expect(script).toContain("miniapp/package.json");
    expect(script).toContain("miniapp/App.wxml");
    expect(script).toContain("miniapp/app.js");
    expect(script).toContain("miniapp/app.json");
    expect(script).toContain("miniapp/app.wxss");
    expect(script).toContain("miniapp/project.config.json");
    expect(script).toContain("miniapp/scripts/dev-mp-weixin.mjs");
    expect(script).toContain("miniapp/scripts/check-hbuilderx-layout.mjs");
    expect(script).toContain("miniapp/scripts/patch-mp-weixin-project-config.mjs");
    expect(script).toContain("miniapp/scripts/sync-mp-weixin-devtools-output.mjs");
    expect(script).toContain("miniapp/custom-tab-bar/index.js");
    expect(script).toContain("miniapp/custom-tab-bar/index.wxml");
    expect(script).toContain("miniapp/custom-tab-bar/index.wxss");
    expect(script).toContain("miniapp/utils/tabBar.ts");
    expect(script).toContain("miniapp/utils/authNavigation.ts");
    expect(script).toContain("miniapp/utils/assetPublishCopy.ts");
    expect(script).toContain("miniapp/utils/assetPublishValidation.ts");
    expect(script).toContain("admin/src/pages/ConfigPage.tsx");

    expect(script).toContain("api/src/db/migrations/013_user_asset_publish_switch.sql::user_asset_publish_enabled");
    expect(script).toContain("api/src/modules/auth/auth.routes.ts::/api/profile/assets");
    expect(script).toContain("api/src/modules/configs/publishConfig.ts::USER_ASSET_PUBLISH_ENABLED_KEY");
    expect(script).toContain("api/src/config/env.ts::MYSQL_CONNECTION_LIMIT");
    expect(script).toContain("api/src/config/env.ts::API_SLOW_REQUEST_THRESHOLD_MS");
    expect(script).toContain("api/src/db/pool.ts::maxIdle: env.mysqlMaxIdle");
    expect(script).toContain("api/src/server.ts::installGracefulShutdown");
    expect(script).toContain("api/src/serverLifecycle.ts::SIGTERM");
    expect(script).toContain("api/src/app.ts::registerRequestTiming");
    expect(script).toContain("api/src/observability/requestTiming.ts::api_request_slow");
    expect(script).toContain("api/src/modules/images/images.routes.ts::asset_publish_disabled");
    expect(script).toContain("api/src/modules/images/images.routes.ts::openid: user.openid");
    expect(script).toContain("api/src/modules/assets/assets.routes.ts::/api/asset-publish-context");
    expect(script).toContain("api/src/modules/assets/assets.routes.ts::remainingDailyPublishCount");
    expect(script).toContain("shared/src/api-contracts.ts::AssetPublishContextResponse");
    expect(script).toContain("miniapp/api/client.ts::getAssetPublishContext");
    expect(script).toContain("miniapp/api/client.ts::listMyAssets");
    expect(script).toContain("miniapp/api/client.ts::listMyExchangeResources");
    expect(script).toContain("miniapp/utils/assetPublishCopy.ts::USER_ASSET_SUBMIT_DISABLED_REASON");
    expect(script).toContain("miniapp/utils/assetPublishCopy.ts::normalizeUserAssetSubmitDisabledReason");
    expect(script).toContain("miniapp/utils/assetPublishValidation.ts::userAssetBaseFieldLabels");
    expect(script).toContain("miniapp/utils/assetPublishValidation.ts::missingUserAssetBaseFieldMessage");
    expect(script).toContain("miniapp/pages.json::pages/profile/assets");
    expect(script).toContain("miniapp/pages.json::pages/auctions/publish");
    expect(script).toContain("miniapp/pages/auctions/publish.vue::提交审核");
    expect(script).toContain("miniapp/pages/auctions/publish.vue::missingUserAssetBaseFieldMessage");
    expect(script).toContain("miniapp/pages/auctions/publish.vue::请重新登录后上传");
    expect(script).toContain("miniapp/pages/profile/assets.vue::getAssetPublishContext");
    expect(script).toContain("miniapp/pages/profile/assets.vue::提交资产");
    expect(script).toContain("miniapp/pages/profile/index.vue::我的交换");
    expect(script).toContain("miniapp/package.json::patch:mp-weixin-project-config");
    expect(script).toContain("miniapp/package.json::patch-mp-weixin-project-config.mjs --assert");
    expect(script).toContain("miniapp/package.json::node scripts/dev-mp-weixin.mjs");
    expect(script).toContain("miniapp/project.config.json::miniprogramRoot");
    expect(script).toContain("miniapp/app.json::devtools/mp-weixin/pages/games/index");
    expect(script).toContain("miniapp/app.js::patchPageNavigationUrls");
    expect(script).toContain("miniapp/app.js::devtools/mp-weixin/app.js");
    expect(script).toContain("miniapp/app.wxss::devtools/mp-weixin/app.wxss");
    expect(script).toContain("miniapp/scripts/check-hbuilderx-layout.mjs::root app.json pages must wrap devtools/mp-weixin pages");
    expect(script).toContain("miniapp/scripts/sync-mp-weixin-devtools-output.mjs::devtools/mp-weixin");
    expect(script).toContain("miniapp/scripts/sync-mp-weixin-devtools-output.mjs::writeRootWrapper");
    expect(script).toContain("miniapp/scripts/dev-mp-weixin.mjs::setInterval");
    expect(script).toContain("miniapp/scripts/dev-mp-weixin.mjs::sync-mp-weixin-devtools-output.mjs");
    expect(script).toContain("miniapp/scripts/patch-mp-weixin-project-config.mjs::--assert");
    expect(script).toContain("miniapp/scripts/patch-mp-weixin-project-config.mjs::miniprogramRoot to empty string");
    expect(script).toContain("miniapp/scripts/patch-mp-weixin-project-config.mjs::points at an output directory without app.json");
    expect(script).toContain("miniapp/buildConfig.test.ts::uses the source root as the stable WeChat DevTools entry and wraps generated output");
    expect(script).toContain("miniapp/buildConfig.test.ts::clears generated miniprogramRoot before validating output app.json");
    expect(script).toContain("miniapp/buildConfig.test.ts::documents the source miniapp directory as the WeChat DevTools import path");
    expect(script).toContain("miniapp/custom-tab-bar/index.js::targetIndex === this.data.selected");
    expect(script).toContain("miniapp/custom-tab-bar/index.js::targetIndex === this.data.selected && normalizeRoute(this.currentRoute()) === pagePath");
    expect(script).toContain("miniapp/custom-tab-bar/index.js::DEVTOOLS_WRAPPER_PREFIX");
    expect(script).toContain("miniapp/custom-tab-bar/index.js::loginProfileUrl");
    expect(script).toContain("miniapp/custom-tab-bar/index.js::!hasUserSession()");
    expect(script).toContain("miniapp/custom-tab-bar/index.wxml::tab-item-hover");
    expect(script).toContain("miniapp/custom-tab-bar/index.wxss::.tab-item.active .tab-surface");
    expect(script).toContain("miniapp/utils/tabBar.ts::syncCustomTabBarSelected");
    expect(script).toContain("miniapp/utils/authNavigation.ts::requireLoginForAction");
    expect(script).toContain("miniapp/utils/authNavigation.ts::loginUrlForRedirect");
    expect(script).toContain("miniapp/utils/authNavigation.ts::navigateAfterLogin");
    expect(script).toContain("miniapp/pages/games/index.vue::syncCustomTabBarSelected(0)");
    expect(script).toContain("miniapp/pages/profile/index.vue::通知中心");
    expect(script).toContain("miniapp/pages/profile/index.vue::notification-dot");
    expect(script).toContain("miniapp/pages/profile/index.vue::我的交换");
    expect(script).toContain("miniapp/pages/profile/index.vue::syncCustomTabBarSelected(1)");
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
    expect(script).toContain("api/src/db/migrations/020_profile_message_delete_state.sql::user_deleted_at");
    expect(script).toContain("api/src/modules/assetConversations/assetConversations.routes.ts::/api/assets/:assetId/conversations/principal");
    expect(script).toContain("api/src/modules/assetConversations/assetConversations.routes.ts::/api/profile/asset-conversations/delete");
    expect(script).toContain("api/src/modules/assetConversations/assetConversations.routes.ts::/admin/asset-conversations");
    expect(script).toContain("api/src/realtime/messageWsServer.ts::/ws/messages");
    expect(script).toContain("shared/src/ws-events.ts::AssetMessageWsEvent");
    expect(script).toContain("miniapp/api/client.ts::createPrincipalConversation");
    expect(script).toContain("miniapp/api/client.ts::deleteAssetConversations");
    expect(script).toContain("miniapp/pages/auctions/detail.vue::联系主理人");
    expect(script).toContain("miniapp/pages/auctions/detail.vue::principalContactState");
    expect(script).toContain("miniapp/pages/auctions/detail.vue::请先登录后再出价");
    expect(script).toContain("miniapp/pages/auctions/detail.vue::登录后联系主理人");
    expect(script).toContain("miniapp/pages/login/login.vue::redirectUrl");
    expect(script).toContain("miniapp/pages/login/login.vue::暂不登录，返回浏览");
    expect(script).toContain("miniapp/pages/loginGate.test.ts::does not force login while browsing public resource pages");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue::realtimeActive");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue::handleRealtimeError");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue::refreshConversationMessages");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue::startMessageRefreshPolling");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue::messageRefreshTimer");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue::请输入消息内容");
    expect(script).toContain("miniapp/pages/profile/notifications.vue::selectionMode");
    expect(script).toContain("miniapp/pages/profile/notifications.vue::全选");
    expect(script).toContain("miniapp/pages/profile/notifications.vue::消息留存免责声明");
    expect(script).toContain("miniapp/pages/profile/notifications.vue::仅保留3个月");
    expect(script).toContain("miniapp/pages/profile/notifications.vue::.tab-button:not(.active)");
    expect(script).toContain("miniapp/pages/profile/notifications.vue::rgba(11, 32, 30, 0.92)");
    expect(script).toContain("admin/src/components/AppLayout.tsx::消息中心");
    expect(script).toContain("admin/src/pages/MessageCenterPage.tsx::发送消息");
    expect(script).toContain("admin/src/pages/MessageCenterPage.tsx::formatMessageTime(message.createdAt)");
    expect(script).toContain("admin/src/pages/MessageCenterPage.tsx::message-time");
    expect(script).toContain("admin/src/pages/MessageCenterPage.tsx::selectedIdRef");
    expect(script).toContain("admin/src/pages/MessageCenterPage.tsx::scheduleReconnect");
  });

  it("rejects archives that do not contain free exchange and seller messaging features", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("api/src/db/migrations/019_exchange_resources.sql");
    expect(script).toContain("api/src/db/migrations/021_exchange_resource_image_amount_expiry.sql");
    expect(script).toContain("api/src/modules/exchangeResources/exchangeResources.routes.ts");
    expect(script).toContain("api/src/modules/exchangeResources/exchangeResources.mysql.repository.ts");
    expect(script).toContain("admin/src/pages/ExchangeResourcePage.tsx");
    expect(script).toContain("api/src/modules/admin/adminPermissions.ts");
    expect(script).toContain("api/src/modules/subscribeMessages/subscribeMessage.service.ts::sendAssetMessage");
    expect(script).toContain("api/src/config/env.ts::WECHAT_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID");
    expect(script).toContain("shared/config/wechat-subscribe-templates.json::replyMessage");
    expect(script).toContain("shared/src/wechatSubscribeTemplates.ts::wechatSubscribeTemplates");
    expect(script).toContain("shared/src/api-contracts.ts::ExchangeResourceListResponse");
    expect(script).toContain("shared/src/ws-events.ts::targetUserId");
    expect(script).toContain("miniapp/pages.json::pages/exchange/list");
    expect(script).toContain("miniapp/pages.json::pages/profile/exchanges");
    expect(script).toContain("miniapp/api/client.ts::createSellerConversation");
    expect(script).toContain("miniapp/utils/share.ts::buildExchangeResourceDetailShare");
    expect(script).toContain("miniapp/utils/share.ts::buildExchangeResourceListShare");
    expect(script).toContain("miniapp/utils/share.ts::buildGameModeShare");
    expect(script).toContain("miniapp/utils/share.ts::buildPriceReferenceShare");
    expect(script).toContain("miniapp/utils/subscribeMessage.ts::requestAssetMessageSubscription");
    expect(script).toContain("miniapp/vite.config.js::UNI_APP_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID");
    expect(script).toContain("miniapp/vite.config.js::__REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID__");
    expect(script).toContain("miniapp/pages/games/mode.vue::自由交换");
    expect(script).toContain("miniapp/pages/games/mode.vue::onShareAppMessage");
    expect(script).toContain("miniapp/pages/games/mode.vue::buildGameModeShare");
    expect(script).toContain("miniapp/pages/exchange/list.vue::getExchangeResourceContext");
    expect(script).toContain("miniapp/pages/exchange/list.vue::publishEnabled");
    expect(script).toContain("miniapp/pages/exchange/list.vue::toolbar-without-publish");
    expect(script).toContain("miniapp/pages/exchange/list.vue::onShareAppMessage");
    expect(script).toContain("miniapp/pages/exchange/list.vue::buildExchangeResourceListShare");
    expect(script).toContain("miniapp/pages/exchange/detail.vue::交易需谨慎");
    expect(script).toContain("miniapp/pages/exchange/detail.vue::这是你发布的资源");
    expect(script).toContain("miniapp/pages/exchange/detail.vue::登录后打招呼");
    expect(script).toContain("api/src/modules/exchangeResources/exchangeResources.routes.ts::这是你发布的资源，不能联系自己");
    expect(script).toContain("api/src/modules/exchangeResources/exchangeResources.routes.ts::/admin/exchange-resources");
    expect(script).toContain("api/src/modules/exchangeResources/exchangeResources.repository.ts::listForAdmin");
    expect(script).toContain("api/src/modules/exchangeResources/exchangeResources.mysql.repository.ts::adminWhere");
    expect(script).toContain("api/src/modules/exchangeResources/exchangeResources.mysql.repository.ts::r.expires_at > CURRENT_TIMESTAMP");
    expect(script).not.toContain("api/src/modules/exchangeResources/exchangeResources.mysql.repository.ts::r.image_url <> ''");
    expect(script).toContain("api/src/modules/exchangeResources/exchangeResources.repository.ts::new Date(right.createdAt)");
    expect(script).toContain("api/src/modules/exchangeResources/exchangeResources.mysql.repository.ts::ORDER BY r.created_at DESC, r.id DESC");
    expect(script).toContain("api/src/modules/admin/adminPermissions.ts::reviewerAssetRemove");
    expect(script).toContain("miniapp/pages/exchange/detail.vue::分享资源");
    expect(script).toContain("miniapp/pages/exchange/detail.vue::onShareAppMessage");
    expect(script).toContain("miniapp/pages/exchange/detail.vue::参考金额");
    expect(script).toContain("miniapp/pages/exchange/detail.vue::resource.imageUrl");
    expect(script).toContain("miniapp/pages/exchange/list.vue::暂无图片");
    expect(script).toContain("miniapp/pages/exchange/detail.vue::暂无图片");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::attribute-textarea");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::请先登录后再上传图片");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::补充说明（选填）");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::参考金额（元宝，选填）");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::龙珠图片");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::交换信息仅保留30天");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::redirectClosedPublishEntry");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::readSessionUser");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::平台不参与交易、不收款、不担保、不托管、不负责线下交付");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::loginUrlForRedirect");
    expect(script).toContain("miniapp/pages/profile/exchanges.vue::closeExchangeResource");
    expect(script).toContain("miniapp/pages/profile/exchanges.vue::getExchangeResourceContext");
    expect(script).toContain("miniapp/pages/profile/exchanges.vue::publishEnabled");
    expect(script).toContain("miniapp/pages/profile/exchanges.vue::关闭交换");
    expect(script).toContain("miniapp/pages/profile/exchanges.vue::图片审核中");
    expect(script).toContain("miniapp/pages/profile/exchanges.vue::已过期");
    expect(script).toContain("miniapp/pages/profile/exchanges.vue::过期时间");
    expect(script).toContain("miniapp/pages/profile/exchanges.vue::暂无图片");
    expect(script).toContain("miniapp/pages/profile/asset-chat.vue::isMineMessage");
    expect(script).toContain("admin/src/App.tsx::ExchangeResourcePage");
    expect(script).toContain("admin/src/components/AppLayout.tsx::交换资源");
    expect(script).toContain("admin/src/pages/ExchangeResourcePage.tsx::adminGet<ExchangeResourceListResponse>");
    expect(script).toContain("admin/src/pages/ExchangeResourcePage.tsx::/admin/exchange-resources");
    expect(script).toContain("admin/src/pages/ExchangeResourcePage.tsx::龙珠信息");
    expect(script).toContain("admin/src/pages/ExchangeResourcePage.tsx::参考金额");
    expect(script).toContain("admin/src/pages/ExchangeResourcePage.tsx::图片审核中");
    expect(script).toContain("admin/src/pages/ExchangeResourcePage.tsx::已过期");
    expect(script).toContain("admin/src/pages/ExchangeResourcePage.tsx::过期时间");
    expect(script).toContain("admin/src/pages/ExchangeResourcePage.tsx::想换什么");
    expect(script).toContain("admin/src/pages/ConfigPage.tsx::free_exchange_publish_enabled");
  });

  it("rejects archives that do not contain dragon ball price reference features", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("api/src/db/migrations/022_dragon_ball_price_references.sql");
    expect(script).toContain("api/src/db/migrations/023_seed_dragon_ball_price_references.sql");
    expect(script).toContain("api/src/modules/dragonBallPriceReferences/dragonBallPriceReferences.routes.ts");
    expect(script).toContain("api/src/modules/dragonBallPriceReferences/dragonBallPriceReferences.repository.ts");
    expect(script).toContain("api/src/modules/dragonBallPriceReferences/dragonBallPriceReferences.mysql.repository.ts");
    expect(script).toContain("api/src/modules/dragonBallPriceReferences/dragonBallPriceReferences.service.ts");
    expect(script).toContain("admin/src/pages/PriceReferencePage.tsx");
    expect(script).toContain("miniapp/pages/priceReference/index.vue");
    expect(script).toContain("shared/src/dragonBall.ts");

    expect(script).toContain("api/src/db/migrations/022_dragon_ball_price_references.sql::dragon_ball_price_reference_batches");
    expect(script).toContain("api/src/db/migrations/022_dragon_ball_price_references.sql::dragon_ball_price_reference_items");
    expect(script).toContain("api/src/db/migrations/023_seed_dragon_ball_price_references.sql::6月1日-6日龙珠品类成交价区间统计");
    expect(script).toContain("api/src/db/migrations/023_seed_dragon_ball_price_references.sql::金色战士");
    expect(script).toContain("api/src/db/migrations/023_seed_dragon_ball_price_references.sql::红色牧师");
    expect(script).toContain("api/src/modules/dragonBallPriceReferences/dragonBallPriceReferences.routes.ts::/api/dragon-ball-price-references/latest");
    expect(script).toContain("api/src/modules/dragonBallPriceReferences/dragonBallPriceReferences.routes.ts::/admin/dragon-ball-price-reference-batches");
    expect(script).toContain("api/src/modules/dragonBallPriceReferences/dragonBallPriceReferences.repository.ts::createInMemoryDragonBallPriceReferencesRepository");
    expect(script).toContain("api/src/modules/dragonBallPriceReferences/dragonBallPriceReferences.mysql.repository.ts::createMysqlDragonBallPriceReferencesRepository");
    expect(script).toContain("shared/src/dragonBall.ts::dragonBallPriceReferenceProfessionOptions");
    expect(script).toContain("shared/src/domain.ts::DragonBallPriceReferenceBatch");
    expect(script).toContain("shared/src/api-contracts.ts::DragonBallPriceReferenceBatchResponse");
    expect(script).toContain("api/src/app.ts::registerDragonBallPriceReferenceRoutes");
    expect(script).toContain("api/src/runtimeApp.ts::createMysqlDragonBallPriceReferencesRepository");
    expect(script).toContain("miniapp/api/client.ts::getDragonBallPriceReferenceLatest");
    expect(script).toContain("miniapp/pages.json::pages/priceReference/index");
    expect(script).toContain("miniapp/pages/games/mode.vue::估值参考");
    expect(script).toContain("miniapp/pages/exchange/publish.vue::合理填写参考金额，能更快找到新主人");
    expect(script).toContain("miniapp/pages/priceReference/index.vue::趋势");
    expect(script).toContain("miniapp/pages/priceReference/index.vue::onShareAppMessage");
    expect(script).toContain("miniapp/pages/priceReference/index.vue::buildPriceReferenceShare");
    expect(script).toContain("miniapp/pages/priceReference/index.vue::latestItems");
    expect(script).toContain("miniapp/pages/priceReference/index.vue::normalizePriceReferenceBatch");
    expect(script).toContain("miniapp/pages/priceReference/index.vue::normalizePriceReferenceTrendItems");
    expect(script).toContain("miniapp/pages/priceReference/index.vue::trendRows");
    expect(script).toContain("miniapp/pages/priceReference/index.vue::barStyle");
    expect(script).toContain("miniapp/scripts/dev-mp-weixin.mjs::--allow-missing-app-json");
    expect(script).toContain("miniapp/scripts/patch-mp-weixin-project-config.mjs::--allow-missing-app-json");
    expect(script).toContain("admin/src/App.tsx::PriceReferencePage");
    expect(script).toContain("admin/src/components/AppLayout.tsx::用户管理");
    expect(script).toContain("admin/src/components/AppLayout.tsx::资产管理");
    expect(script).toContain("admin/src/components/AppLayout.tsx::配置管理");
    expect(script).toContain("admin/src/components/AppLayout.tsx::主理人资源");
    expect(script).toContain("admin/src/components/AppLayout.tsx::估值参考");
    expect(script).toContain("admin/src/components/AppLayout.tsx::nav-group-title");
    expect(script).toContain("admin/src/components/AppLayout.tsx::nav-standalone");
    expect(script).not.toContain("admin/src/components/AppLayout.tsx::价格参考");
    expect(script).not.toContain("admin/src/components/AppLayout.tsx::成交跟进");
    expect(script).toContain("admin/src/pages/AssetDataPage.tsx::主理人资源");
    expect(script).toContain("admin/src/pages/PriceReferencePage.tsx::周估值参考");
    expect(script).toContain("admin/src/pages/PriceReferencePage.tsx::copyBatchToCurrentWeek");
    expect(script).toContain("admin/src/pages/PriceReferencePage.tsx::已复制");
    expect(script).toContain("admin/src/pages/PriceReferencePage.tsx::复制自");
    expect(script).toContain("admin/src/pages/PriceReferencePage.tsx::最低价不能大于最高价");
    expect(script).toContain("估值参考");
    expect(script).toContain("周估值参考");
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
