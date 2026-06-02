import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const miniappRoot = resolve(import.meta.dirname, "..");

function readPage(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp user publishing removal", () => {
  it("removes user publishing entry points from visible miniapp pages", () => {
    const auctionListPage = readPage("pages/auctions/list.vue");
    const profilePage = readPage("pages/profile/index.vue");
    const pagesConfig = readPage("pages.json");

    expect(auctionListPage).not.toContain("openPublish");
    expect(auctionListPage).not.toContain("发布{{ selectedAssetType }}");
    expect(profilePage).not.toContain("我的发布");
    expect(profilePage).not.toContain("/pages/profile/assets");
    expect(pagesConfig).not.toContain("pages/auctions/publish");
    expect(pagesConfig).not.toContain("pages/profile/assets");
  });
});
