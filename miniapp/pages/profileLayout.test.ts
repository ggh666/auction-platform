import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const profilePagePath = resolve(import.meta.dirname, "profile/index.vue");

describe("profile page layout", () => {
  it("keeps the logout button scrollable above ads and the custom tab bar", () => {
    const page = readFileSync(profilePagePath, "utf8");

    expect(page).toContain("退出登录");
    expect(page).toContain("calc(180rpx + env(safe-area-inset-bottom))");
    expect(page).toContain("box-sizing: border-box");
  });

  it("moves notifications into the top action area as notification center", () => {
    const page = readFileSync(profilePagePath, "utf8");

    expect(page).toContain("通知中心");
    expect(page).toContain("@tap=\"go('/pages/profile/notifications')\"");
    expect(page).toContain("top-actions");
    expect(page).not.toContain("查看参与交换后的新出价提醒");
    expect(page).not.toContain("<text class=\"menu-title\">消息通知</text>");
  });

  it("shows the notification center red dot when either notifications or conversations are unread", () => {
    const page = readFileSync(profilePagePath, "utf8");

    expect(page).toContain("listAssetConversations");
    expect(page).toContain("unreadConversations");
    expect(page).toContain("hasUnreadNotificationCenter");
    expect(page).toContain("v-if=\"hasUnreadNotificationCenter\"");
    expect(page).toContain("notification-dot");
  });

  it("hides bid, user asset, and deal record entries from the miniapp profile menu", () => {
    const page = readFileSync(profilePagePath, "utf8");

    expect(page).not.toContain("<text class=\"menu-title\">我的出价</text>");
    expect(page).not.toContain("go('/pages/profile/bids')");
    expect(page).not.toContain("<text class=\"menu-title\">我的资产</text>");
    expect(page).not.toContain("go('/pages/profile/assets')");
    expect(page).not.toContain("<text class=\"menu-title\">成交记录</text>");
    expect(page).not.toContain("go('/pages/profile/results')");
    expect(page).toContain("<text class=\"menu-title\">我的交换</text>");
    expect(page).toContain("<text class=\"menu-title\">联系客服</text>");
  });
});
