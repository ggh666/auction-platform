import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const resultsPagePath = resolve(import.meta.dirname, "profile/results.vue");

describe("profile results page", () => {
  it("paginates result records, shows asset names, and does not show a disclaimer modal", () => {
    const page = readFileSync(resultsPagePath, "utf8");

    expect(page).toContain("onReachBottom");
    expect(page).toContain("page: requestedPage");
    expect(page).toContain("pageSize");
    expect(page).toContain("result.asset.title");
    expect(page).not.toContain("confirmTradingDisclaimer");
    expect(page).not.toContain("readSessionUser");
  });
});
