import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const listPagePath = resolve(import.meta.dirname, "auctions/list.vue");
const clientPath = resolve(import.meta.dirname, "../api/client.ts");

describe("miniapp asset list filters", () => {
  it("exposes principal and Dragon Ball filters on the prop list", () => {
    const page = readFileSync(listPagePath, "utf8");
    const client = readFileSync(clientPath, "utf8");

    expect(page).toContain("filter-panel");
    expect(page).toContain("筛选主理人");
    expect(page).toContain("龙珠职业");
    expect(page).toContain("龙珠品质");
    expect(page).toContain("loadPrincipalOptions");
    expect(page).toContain("listPrincipals");
    expect(page).toContain("principalId: selectedPrincipalId.value || undefined");
    expect(page).toContain("dragonBallProfession: selectedAssetType.value === \"道具\" ? selectedDragonBallProfession.value || undefined : undefined");
    expect(page).toContain("dragonBallQuality: selectedAssetType.value === \"道具\" ? selectedDragonBallQuality.value || undefined : undefined");
    expect(page).toContain("resetDragonBallFilters()");
    expect(client).toContain("principalId?: string");
    expect(client).toContain("dragonBallProfession?: string");
    expect(client).toContain("dragonBallQuality?: string");
    expect(client).toContain("listPrincipals");
  });
});
