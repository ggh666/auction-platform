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
});
