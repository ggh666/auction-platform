import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const miniappRoot = resolve(import.meta.dirname, "..");

function readPage(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("sold asset stamp placement", () => {
  it("shows a sold stamp on frontend asset surfaces", () => {
    const detailPage = readPage("pages/auctions/detail.vue");
    const listPage = readPage("pages/auctions/list.vue");
    const profileFollowsPage = readPage("pages/profile/follows.vue");
    const profileBidsPage = readPage("pages/profile/bids.vue");

    for (const page of [detailPage, listPage, profileFollowsPage, profileBidsPage]) {
      expect(page).toContain("isSoldAsset");
      expect(page).toContain("sold-stamp");
      expect(page).toContain("成交");
    }
  });
});
