import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const miniappRoot = resolve(import.meta.dirname, "..");

function readPage(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("profile exchange and hidden follow placement", () => {
  it("hides frontend follow entry points and exposes my exchanges from profile", () => {
    const auctionListPage = readPage("pages/auctions/list.vue");
    const profilePage = readPage("pages/profile/index.vue");
    const exchangesPage = readPage("pages/profile/exchanges.vue");
    const pagesConfig = readPage("pages.json");

    expect(auctionListPage).not.toContain("我的关注");
    expect(auctionListPage).not.toContain("toggleFollow");
    expect(auctionListPage).not.toContain("follow-button");
    expect(profilePage).not.toContain("go('/pages/profile/follows')");
    expect(profilePage).not.toContain("我的关注");
    expect(profilePage).not.toContain("listFollowedAssets");
    expect(profilePage).toContain("go('/pages/profile/exchanges')");
    expect(profilePage).toContain("我的交换");
    expect(exchangesPage).toContain("我的交换");
    expect(exchangesPage).toContain("listMyExchangeResources");
    expect(exchangesPage).toContain("closeExchangeResource");
    expect(pagesConfig).not.toContain('"path": "pages/profile/follows"');
    expect(pagesConfig).toContain('"path": "pages/profile/exchanges"');
  });
});
