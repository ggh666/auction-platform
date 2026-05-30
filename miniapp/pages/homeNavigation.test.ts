import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const miniappRoot = resolve(import.meta.dirname, "..");
const homeSwitchCall = 'uni.switchTab({ url: "/pages/games/index" })';

function readPage(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp home navigation", () => {
  it("shows a home entry from the profile center", () => {
    const profilePage = readPage("pages/profile/index.vue");

    expect(profilePage).toContain("@tap=\"goHome\"");
    expect(profilePage).toContain("返回主页");
    expect(profilePage).toContain(homeSwitchCall);
  });

  it("shows a home entry from the asset list after choosing a game", () => {
    const assetListPage = readPage("pages/auctions/list.vue");

    expect(assetListPage).toContain("@tap=\"goHome\"");
    expect(assetListPage).toContain("返回主页");
    expect(assetListPage).toContain(homeSwitchCall);
  });
});
