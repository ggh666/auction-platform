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
});
