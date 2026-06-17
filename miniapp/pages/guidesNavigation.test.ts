import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import pagesConfig from "../pages.json";

const miniappRoot = resolve(import.meta.dirname, "..");

function readMiniappFile(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp guides navigation", () => {
  it("registers guides pages and exposes the guides tab between resources and profile", () => {
    const paths = pagesConfig.pages.map((page) => page.path);
    const tabBar = readMiniappFile("custom-tab-bar/index.js");
    const guidesPage = readMiniappFile("pages/guides/index.vue");
    const profilePage = readMiniappFile("pages/profile/index.vue");

    expect(paths).toContain("pages/guides/index");
    expect(paths).toContain("pages/guides/redeem-codes");
    expect(paths).toContain("pages/guides/dragon-ball-system");
    expect(paths).toContain("pages/guides/deep-sea-battle");
    expect(paths).toContain("pages/guides/deep-sea-boss");
    expect(pagesConfig.tabBar.list.map((item) => item.text)).toEqual(["资源", "攻略", "我的"]);
    expect(tabBar).toContain('{ pagePath: "pages/guides/index", text: "攻略" }');
    expect(guidesPage).toContain("syncCustomTabBarSelected(1)");
    expect(profilePage).toContain("syncCustomTabBarSelected(2)");
  });

  it("loads redeem codes from the API and copies the tapped code", () => {
    const apiClient = readMiniappFile("api/client.ts");
    const guidesPage = readMiniappFile("pages/guides/index.vue");
    const redeemCodePage = readMiniappFile("pages/guides/redeem-codes.vue");

    expect(apiClient).toContain("listRedeemCodes");
    expect(apiClient).toContain("/api/redeem-codes");
    expect(guidesPage).toContain("@tap=\"openRedeemCodes\"");
    expect(guidesPage).toContain("兑换码");
    expect(guidesPage).toContain("uni.showShareMenu");
    expect(guidesPage).toContain("onShareAppMessage");
    expect(guidesPage).toContain("onShareTimeline");
    expect(guidesPage).toContain("buildGuidesShare");
    expect(redeemCodePage).toContain("listRedeemCodes");
    expect(redeemCodePage).toContain("uni.setClipboardData");
    expect(redeemCodePage).toContain("uni.showShareMenu");
    expect(redeemCodePage).toContain("onShareAppMessage");
    expect(redeemCodePage).toContain("onShareTimeline");
    expect(redeemCodePage).toContain("buildRedeemCodesShare");
    expect(redeemCodePage).toContain("暂无兑换码");
    expect(redeemCodePage).toContain("点击复制兑换码");
    expect(redeemCodePage).toContain("#071112");
    expect(redeemCodePage).toContain("repeating-linear-gradient");
    expect(redeemCodePage).toContain("rgba(246, 196, 83, 0.34)");
    expect(redeemCodePage).toContain("tap-hint");
    expect(redeemCodePage).not.toContain("background: #f8fafc");
    expect(redeemCodePage).not.toContain("background: #fff;");
  });

  it("adds a fixed dragon ball system guide entry and content page", () => {
    const guidesPage = readMiniappFile("pages/guides/index.vue");
    const dragonBallPage = readMiniappFile("pages/guides/dragon-ball-system.vue");
    const deepSeaBattlePage = readMiniappFile("pages/guides/deep-sea-battle.vue");
    const deepSeaBossPage = readMiniappFile("pages/guides/deep-sea-boss.vue");

    expect(guidesPage).toContain("@tap=\"openDeepSeaBattle\"");
    expect(guidesPage).toContain("/pages/guides/deep-sea-battle");
    expect(guidesPage.indexOf("副本计算")).toBeLessThan(guidesPage.indexOf("深海之战"));
    expect(guidesPage.indexOf("深海之战")).toBeLessThan(guidesPage.indexOf("其它"));
    expect(guidesPage.indexOf("其它")).toBeLessThan(guidesPage.indexOf("龙珠体系"));
    expect(guidesPage).toContain("@tap=\"openDragonBallSystem\"");
    expect(guidesPage).toContain("/pages/guides/dragon-ball-system");
    expect(guidesPage).toContain("龙珠体系");
    expect(dragonBallPage).toContain("品质属性范围");
    expect(dragonBallPage).toContain("查看龙珠系统介绍");
    expect(dragonBallPage).toContain("龙珠获取方式");
    expect(dragonBallPage).toContain("波澜之主成就");
    expect(dragonBallPage).toContain("第1名礼盒概率");
    expect(dragonBallPage).toContain("501-1000名礼盒概率");
    expect(dragonBallPage).toContain("onShareAppMessage");
    expect(dragonBallPage).toContain("buildDragonBallSystemShare");
    expect(dragonBallPage).toContain("#071112");
    expect(deepSeaBattlePage).toContain("deepSeaMapRows");
    expect(deepSeaBattlePage).toContain("openDeepSeaBoss");
    expect(deepSeaBattlePage).toContain("buildDeepSeaBattleShare");
    expect(deepSeaBattlePage).toContain("royal-city");
    expect(deepSeaBattlePage).toContain("#071112");
    expect(deepSeaBossPage).toContain("calculateDeepSeaBoss");
    expect(deepSeaBossPage).toContain("levelOptions");
    expect(deepSeaBossPage).toContain("装备");
    expect(deepSeaBossPage).toContain("魔抗减免");
    expect(deepSeaBossPage).toContain("伤害减免");
    expect(deepSeaBossPage).toContain("buildDeepSeaBossShare");
  });
});
