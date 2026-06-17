import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pagesConfig from "../pages.json";

describe("miniapp page configuration", () => {
  it("does not expose report submission pages in the miniapp", () => {
    expect(pagesConfig.pages.map((page) => page.path)).not.toContain("pages/reports/create");
  });

  it("exposes user asset list and publish pages in the miniapp", () => {
    const paths = pagesConfig.pages.map((page) => page.path);

    expect(paths).toContain("pages/auctions/publish");
    expect(paths).toContain("pages/profile/assets");
    expect(paths).toContain("pages/profile/exchanges");
    expect(paths).toContain("pages/guides/index");
    expect(paths).toContain("pages/guides/redeem-codes");
    expect(paths).toContain("pages/guides/dragon-ball-system");
    expect(paths).toContain("pages/guides/deep-sea-battle");
    expect(paths).toContain("pages/guides/deep-sea-boss");
  });

  it("renders the custom tab bar labels with regular miniapp views", () => {
    const tabBarMarkup = readFileSync(
      resolve(import.meta.dirname, "../custom-tab-bar/index.wxml"),
      "utf8"
    );
    const tabBarScript = readFileSync(resolve(import.meta.dirname, "../custom-tab-bar/index.js"), "utf8");
    const tabBarStyles = readFileSync(resolve(import.meta.dirname, "../custom-tab-bar/index.wxss"), "utf8");

    expect(tabBarMarkup).toContain('wx:for="{{list}}"');
    expect(tabBarMarkup).toContain("{{item.text}}");
    expect(tabBarMarkup).toContain('hover-class="tab-item-hover"');
    expect(tabBarMarkup).toContain('data-index="{{index}}"');
    expect(tabBarScript).toContain("this.setData({ selected: targetIndex })");
    expect(tabBarScript).toContain("currentRoute()");
    expect(tabBarScript).toContain("DEVTOOLS_WRAPPER_PREFIX");
    expect(tabBarScript).toContain("normalizeRoute");
    expect(tabBarScript).toContain("routePrefix");
    expect(tabBarScript).toContain("prefixedPagePath(pagePath)");
    expect(tabBarScript).toContain("targetIndex === this.data.selected && normalizeRoute(this.currentRoute()) === pagePath");
    expect(tabBarStyles).toContain(".tab-item-hover");
    expect(tabBarStyles).toContain(".tab-item.active .tab-surface");
    expect(tabBarMarkup).not.toContain("cover-view");
    expect(tabBarMarkup).not.toContain("cover-text");
  });

  it("syncs the custom tab bar selected state from tab pages on show", () => {
    const gamesPage = readFileSync(resolve(import.meta.dirname, "games/index.vue"), "utf8");
    const guidesPage = readFileSync(resolve(import.meta.dirname, "guides/index.vue"), "utf8");
    const profilePage = readFileSync(resolve(import.meta.dirname, "profile/index.vue"), "utf8");
    const tabBarUtil = readFileSync(resolve(import.meta.dirname, "../utils/tabBar.ts"), "utf8");

    expect(gamesPage).toContain("syncCustomTabBarSelected(0)");
    expect(guidesPage).toContain("syncCustomTabBarSelected(1)");
    expect(profilePage).toContain("syncCustomTabBarSelected(2)");
    expect(tabBarUtil).toContain("getTabBar");
    expect(tabBarUtil).toContain("setTimeout");
  });
});
