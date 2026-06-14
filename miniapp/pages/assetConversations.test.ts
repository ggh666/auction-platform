import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import pagesConfig from "../pages.json";

const miniappRoot = resolve(import.meta.dirname, "..");

function readMiniappFile(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp asset conversations", () => {
  it("exposes an asset conversation chat page and entry points", () => {
    const paths = pagesConfig.pages.map((page) => page.path);
    const detailPage = readMiniappFile("pages/auctions/detail.vue");
    const notificationsPage = readMiniappFile("pages/profile/notifications.vue");
    const chatPage = readMiniappFile("pages/profile/asset-chat.vue");
    const client = readMiniappFile("api/client.ts");

    expect(paths).toContain("pages/profile/asset-chat");
    expect(detailPage).toContain("联系主理人");
    expect(detailPage).toContain("openPrincipalConversation");
    expect(detailPage).toContain("参与估价后可联系主理人");
    expect(notificationsPage).toContain("通知 / 消息");
    expect(notificationsPage).toContain("listAssetConversations");
    expect(notificationsPage).toContain("openAssetConversation");
    expect(chatPage).toContain("sendAssetConversationMessage");
    expect(chatPage).toContain("connectMessageSocket");
    expect(chatPage).toContain("请输入消息内容");
    expect(client).toContain("createPrincipalConversation");
    expect(client).toContain("listAssetConversations");
  });

  it("keeps asset conversation fields backward compatible and releases sockets when pages hide", () => {
    const detailPage = readMiniappFile("pages/auctions/detail.vue");
    const chatPage = readMiniappFile("pages/profile/asset-chat.vue");

    expect(detailPage).toContain("principalContactState");
    expect(detailPage).not.toContain("detail.principalContact.enabled");
    expect(detailPage).not.toContain("detail.value.principalContact.enabled");
    expect(detailPage).toContain("onHide(() =>");
    expect(detailPage).toContain("closeAuctionRealtime();");
    expect(chatPage).toContain("onHide(() =>");
    expect(chatPage).toContain("closeRealtime();");
  });

  it("reconnects and refreshes the active chat after realtime socket errors", () => {
    const chatPage = readMiniappFile("pages/profile/asset-chat.vue");

    expect(chatPage).toContain("handleRealtimeOpen");
    expect(chatPage).toContain("handleRealtimeError");
    expect(chatPage).toContain("socket = null;");
    expect(chatPage).toContain("void refreshConversationMessages();");
  });

  it("polls the active chat as a fallback when message sockets are unavailable", () => {
    const chatPage = readMiniappFile("pages/profile/asset-chat.vue");

    expect(chatPage).toContain("messageRefreshTimer");
    expect(chatPage).toContain("startMessageRefreshPolling");
    expect(chatPage).toContain("stopMessageRefreshPolling");
    expect(chatPage).toContain("setInterval");
    expect(chatPage).toContain("3000");
  });
});
