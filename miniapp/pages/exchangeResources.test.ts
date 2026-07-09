import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import pagesConfig from "../pages.json";

const miniappRoot = resolve(import.meta.dirname, "..");

function readMiniappFile(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp exchange resources", () => {
  it("routes game selection through a mode page before delegated auctions or free exchange", () => {
    const paths = pagesConfig.pages.map((page) => page.path);
    const gamesPage = readMiniappFile("pages/games/index.vue");
    const modePage = readMiniappFile("pages/games/mode.vue");

    expect(paths).toContain("pages/games/mode");
    expect(paths).toContain("pages/exchange/list");
    expect(paths).toContain("pages/exchange/detail");
    expect(paths).toContain("pages/exchange/publish");
    expect(gamesPage).toContain("/pages/games/mode");
    expect(modePage).toContain("委托主理人");
    expect(modePage).toContain("自由交换");
    expect(modePage).toContain("/pages/auctions/list");
    expect(modePage).toContain("/pages/exchange/list");
    expect(modePage).toContain("uni.showShareMenu");
    expect(modePage).toContain("onShareAppMessage");
    expect(modePage).toContain("onShareTimeline");
    expect(modePage).toContain("buildGameModeShare");
  });

  it("does not restrict delegated auction browsing to recent creation dates", () => {
    const listPage = readMiniappFile("pages/auctions/list.vue");

    expect(listPage).toContain("listAssets({");
    expect(listPage).not.toContain("createdWithinDays:");
  });

  it("provides free exchange list/detail/publish pages with seller contact safety flow", () => {
    const listPage = readMiniappFile("pages/exchange/list.vue");
    const detailPage = readMiniappFile("pages/exchange/detail.vue");
    const publishPage = readMiniappFile("pages/exchange/publish.vue");
    const profileExchangesPage = readMiniappFile("pages/profile/exchanges.vue");
    const client = readMiniappFile("api/client.ts");

    expect(listPage).toContain("listExchangeResources");
    expect(listPage).toContain("getExchangeResourceContext");
    expect(listPage).toContain("uni.showShareMenu");
    expect(listPage).toContain("onShareAppMessage");
    expect(listPage).toContain("onShareTimeline");
    expect(listPage).toContain("buildExchangeResourceListShare");
    expect(listPage).toContain("发布交换");
    expect(listPage).toContain('v-if="publishEnabled"');
    expect(listPage).toContain("toolbar-without-publish");
    expect(listPage).not.toContain("publishDisabledReason");
    expect(listPage).not.toContain("暂未开放自由交换发布");
    expect(listPage).toContain("未填区服");
    expect(detailPage).toContain("交易需谨慎");
    expect(detailPage).toContain("暂无补充说明");
    expect(detailPage).toContain("平台仅提供信息展示与站内沟通");
    expect(detailPage).toContain("requestAssetMessageSubscription");
    expect(detailPage).toContain("createSellerConversation");
    expect(detailPage).toContain("readSessionUser");
    expect(detailPage).toContain("isOwnResource");
    expect(detailPage).toContain("这是你发布的资源");
    expect(detailPage).toContain(":disabled=\"contacting || isOwnResource\"");
    expect(detailPage).toContain("open-type=\"share\"");
    expect(detailPage).toContain("分享资源");
    expect(detailPage).toContain("onShareAppMessage");
    expect(detailPage).toContain("onShareTimeline");
    expect(detailPage).toContain("buildExchangeResourceDetailShare");
    expect(detailPage).toContain("resource.imageUrl");
    expect(detailPage).toContain('v-if="resource.imageUrl"');
    expect(detailPage).toContain("参考金额");
    expect(publishPage).toContain("createExchangeResource");
    expect(publishPage).toContain("requestAssetMessageSubscription");
    expect(publishPage).toContain("想换什么");
    expect(publishPage).toContain("参考金额（元宝，选填）");
    expect(publishPage).toContain("龙珠图片");
    expect(publishPage).toContain("最多 1 张");
    expect(publishPage).toContain("交换信息仅保留30天");
    expect(publishPage).not.toContain("暂未开放自由交换发布");
    expect(publishPage).toContain("redirectClosedPublishEntry");
    expect(publishPage).toContain("readSessionUser");
    expect(publishPage).not.toContain("loginRequired.value = true");
    expect(publishPage).toContain("平台不参与交易、不收款、不担保、不托管、不负责线下交付");
    expect(publishPage).toContain("我已阅读并同意免责声明");
    expect(publishPage).toContain("去登录");
    expect(publishPage).toContain("loginUrlForRedirect");
    expect(publishPage).toContain("uploadAssetImage");
    expect(publishPage).toContain("gameName: gameOptions[0]");
    expect(publishPage).toContain("singleGameOption");
    expect(publishPage).toContain("已默认选中");
    expect(publishPage).toContain('textarea v-model="form.dragonBallAttributes"');
    expect(publishPage).toContain(':disabled="uploadingImage"');
    expect(publishPage).toContain("loginRequired");
    const resetPublishEntryStateIndex = publishPage.indexOf("publishEnabled.value = false;\n  loginRequired.value = false;");
    const readPublishContextIndex = publishPage.indexOf("const response = await getExchangeResourceContext(form.gameName);");
    expect(resetPublishEntryStateIndex).toBeGreaterThanOrEqual(0);
    expect(resetPublishEntryStateIndex).toBeLessThan(readPublishContextIndex);
    expect(publishPage).not.toContain("区服（选填）");
    expect(publishPage).not.toContain("form.serverName");
    expect(publishPage).not.toContain(':disabled="uploadingImage || !publishEnabled"');
    expect(publishPage).toContain("补充说明（选填）");
    expect(publishPage).not.toContain("起拍价");
    expect(publishPage).not.toContain("最低加价");
    expect(publishPage).not.toContain("请填写游戏、区服和标题");
    expect(publishPage).not.toContain("请填写想换什么和补充说明");
    expect(publishPage).not.toContain("主理人");
    expect(listPage).toContain("resource.imageUrl");
    expect(listPage).toContain('v-if="resource.imageUrl"');
    expect(listPage).toContain("暂无图片");
    expect(profileExchangesPage).toContain('v-if="resource.imageUrl"');
    expect(profileExchangesPage).toContain("暂无图片");
    expect(profileExchangesPage).toContain("getExchangeResourceContext");
    expect(profileExchangesPage).toContain('v-if="publishEnabled"');
    expect(profileExchangesPage).not.toContain("publishDisabledReason");
    expect(profileExchangesPage).not.toContain("暂未开放自由交换发布");
    expect(listPage).toContain("参考金额");
    expect(client).toContain("listExchangeResources");
    expect(client).toContain("createSellerConversation");
  });

  it("renders user-user chat bubbles from sender user id instead of sender type alone", () => {
    const chatPage = readMiniappFile("pages/profile/asset-chat.vue");

    expect(chatPage).toContain("currentUserId");
    expect(chatPage).toContain("isMineMessage(message)");
    expect(chatPage).not.toContain("message.senderType === 'user' }");
  });
});
