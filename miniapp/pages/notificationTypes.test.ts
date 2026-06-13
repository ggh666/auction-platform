import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const notificationsPagePath = resolve(import.meta.dirname, "profile/notifications.vue");

describe("profile notification page types", () => {
  it("keeps miniapp notification taps on asset details without exposing deal contact reminders", () => {
    const page = readFileSync(notificationsPagePath, "utf8");

    expect(page).not.toContain("deal_contact_required");
    expect(page).not.toContain("请补充成交联系信息");
    expect(page).not.toContain("/pages/profile/results?assetId=");
    expect(page).toContain("/pages/auctions/detail?assetId=");
  });

  it("offers a bulk read action when there are unread notifications", () => {
    const page = readFileSync(notificationsPagePath, "utf8");

    expect(page).toContain("全部已读");
    expect(page).toContain("v-if=\"unreadCount > 0\"");
    expect(page).toContain("@tap.stop=\"markAllRead\"");
    expect(page).toContain("markAllNotificationsRead");
    expect(page).toContain("markingAllRead");
  });

  it("offers multi-select deletion for notifications and message conversations", () => {
    const page = readFileSync(notificationsPagePath, "utf8");
    const client = readFileSync(resolve(import.meta.dirname, "../api/client.ts"), "utf8");

    expect(page).toContain("管理");
    expect(page).toContain("全选");
    expect(page).toContain("删除");
    expect(page).toContain("selectionMode");
    expect(page).toContain("selectedNotificationIds");
    expect(page).toContain("selectedConversationIds");
    expect(page).toContain("deleteNotifications");
    expect(page).toContain("deleteAssetConversations");
    expect(client).toContain("/api/profile/notifications/delete");
    expect(client).toContain("/api/profile/asset-conversations/delete");
  });

  it("shows a retention disclaimer for notification center records", () => {
    const page = readFileSync(notificationsPagePath, "utf8");

    expect(page).toContain("消息留存免责声明");
    expect(page).toContain("仅保留3个月");
    expect(page).toContain("历史消息会按规则定期删除");
    expect(page).toContain("清理后的记录无法恢复");
    expect(page).toContain("retention-notice");
  });

  it("keeps inactive notification tabs visually distinct from the page background", () => {
    const page = readFileSync(notificationsPagePath, "utf8");

    expect(page).toContain(".tab-button:not(.active)");
    expect(page).toContain("rgba(11, 32, 30, 0.92)");
    expect(page).toContain("border: 1px solid rgba(246, 196, 83, 0.24)");
  });

  it("keeps message list unavailable fallback quiet while the API is not deployed", () => {
    const page = readFileSync(notificationsPagePath, "utf8");
    const client = readFileSync(resolve(import.meta.dirname, "../api/client.ts"), "utf8");

    expect(page).toContain("isApiNotFound(error)");
    expect(page).toContain("statusCode === 404");
    expect(client).toContain("statusCode: response.statusCode");
  });
});
