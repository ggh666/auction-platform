import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMiniappFile(path: string): string {
  return readFileSync(resolve(import.meta.dirname, `../${path}`), "utf8");
}

describe("miniapp on-demand login gates", () => {
  it("does not force login while browsing public resource pages", () => {
    const homePage = readMiniappFile("pages/games/index.vue");
    const auctionListPage = readMiniappFile("pages/auctions/list.vue");
    const exchangeListPage = readMiniappFile("pages/exchange/list.vue");

    expect(homePage).not.toContain("/pages/login/login");
    expect(auctionListPage).not.toContain("/pages/login/login");
    expect(exchangeListPage).not.toContain("/pages/login/login");
  });

  it("requires login only for bidding and conversation actions on detail pages", () => {
    const auctionDetailPage = readMiniappFile("pages/auctions/detail.vue");
    const exchangeDetailPage = readMiniappFile("pages/exchange/detail.vue");

    expect(auctionDetailPage).toContain('requireLoginForAction("请先登录后再出价"');
    expect(auctionDetailPage).toContain('requireLoginForAction("登录后联系主理人"');
    expect(exchangeDetailPage).toContain('requireLoginForAction("登录后联系发布者"');
  });

  it("requires login when switching to the profile tab without trapping back navigation", () => {
    const tabBar = readMiniappFile("custom-tab-bar/index.js");
    const profilePage = readMiniappFile("pages/profile/index.vue");
    const profileOnShow = profilePage.slice(profilePage.indexOf("onShow(async () => {"), profilePage.indexOf("function go("));

    expect(tabBar).toContain("loginProfileUrl");
    expect(tabBar).toContain("routePrefix");
    expect(tabBar).toContain("pagePath === PROFILE_PAGE_PATH");
    expect(tabBar).toContain("!hasUserSession()");
    expect(profilePage).toContain("login-panel");
    expect(profilePage).toContain("goLogin");
    expect(profileOnShow).not.toContain('uni.navigateTo({ url: "/pages/login/login" })');
  });

  it("lets the login page redirect back to the page that requested login", () => {
    const loginPage = readMiniappFile("pages/login/login.vue");
    const authNavigation = readMiniappFile("utils/authNavigation.ts");

    expect(loginPage).toContain("redirectUrl");
    expect(loginPage).toContain("navigateAfterLogin");
    expect(loginPage).toContain("暂不登录，返回浏览");
    expect(loginPage).toContain("cancelLogin");
    expect(authNavigation).toContain("loginUrlForRedirect");
    expect(authNavigation).toContain("safeLoginRedirect");
    expect(authNavigation).toContain("currentPageUrl");
  });
});
