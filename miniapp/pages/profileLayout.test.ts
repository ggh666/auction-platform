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
});
