import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const miniappRoot = resolve(import.meta.dirname, "..");

function readPage(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp user asset publishing dragon ball fields", () => {
  it("matches the admin publish form for dragon ball item publishing", () => {
    const page = readPage("pages/auctions/publish.vue");

    expect(page).toContain("道具分类");
    expect(page).toContain("普通道具");
    expect(page).toContain("龙珠");
    expect(page).toContain("龙珠属性");
    expect(page).toContain("dragonBallProfessionOptions");
    expect(page).toContain("dragonBallQualityOptions");
    expect(page).toContain('itemCategory: form.assetType === "道具" ? form.itemCategory || undefined : undefined');
    expect(page).toContain('form.assetType === "道具" && form.itemCategory === "龙珠"');
    expect(page).toContain("dragonBall:");
  });
});
