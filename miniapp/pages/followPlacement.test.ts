import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const miniappRoot = resolve(import.meta.dirname, "..");

function readPage(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("follow list placement", () => {
  it("keeps my follows behind a profile menu entry", () => {
    const auctionListPage = readPage("pages/auctions/list.vue");
    const profilePage = readPage("pages/profile/index.vue");
    const followsPage = readPage("pages/profile/follows.vue");
    const pagesConfig = readPage("pages.json");

    expect(auctionListPage).not.toContain("我的关注");
    expect(profilePage).toContain("go('/pages/profile/follows')");
    expect(profilePage).not.toContain("listFollowedAssets");
    expect(followsPage).toContain("我的关注");
    expect(followsPage).toContain("listFollowedAssets");
    expect(pagesConfig).toContain('"path": "pages/profile/follows"');
  });
});
