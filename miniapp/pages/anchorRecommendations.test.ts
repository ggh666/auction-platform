import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import pagesConfig from "../pages.json";

const miniappRoot = resolve(import.meta.dirname, "..");

function readMiniappFile(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp anchor recommendations", () => {
  it("adds an anchor recommendation entry under resources", () => {
    const paths = pagesConfig.pages.map((page) => page.path);
    const gamesPage = readMiniappFile("pages/games/index.vue");

    expect(paths).toContain("pages/anchors/index");
    expect(gamesPage).toContain("主播推荐");
    expect(gamesPage).toContain("/pages/anchors/index");
    expect(gamesPage).toContain("主播与攻略内容推荐");
  });

  it("renders a public anchor recommendation list page", () => {
    const page = readMiniappFile("pages/anchors/index.vue");
    const client = readMiniappFile("api/client.ts");

    expect(page).toContain("listAnchorRecommendations");
    expect(page).toContain("anchor.imageUrl");
    expect(page).toContain("anchor.name");
    expect(page).toContain("anchor.intro");
    expect(page).toContain("暂无主播推荐");
    expect(client).toContain("listAnchorRecommendations");
    expect(client).toContain("/api/anchor-recommendations");
  });

  it("enables WeChat sharing for the anchor recommendation page", () => {
    const page = readMiniappFile("pages/anchors/index.vue");

    expect(page).toContain('open-type="share"');
    expect(page).toContain("uni.showShareMenu");
    expect(page).toContain("onShareAppMessage");
    expect(page).toContain("onShareTimeline");
    expect(page).toContain("buildAnchorRecommendationsShare");
  });

  it("previews an anchor image when the image is tapped", () => {
    const page = readMiniappFile("pages/anchors/index.vue");

    expect(page).toContain('@tap="previewAnchorImage(anchor.imageUrl)"');
    expect(page).toContain("function previewAnchorImage");
    expect(page).toContain("uni.previewImage");
  });
});
