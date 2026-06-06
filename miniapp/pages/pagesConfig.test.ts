import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pagesConfig from "../pages.json";

describe("miniapp page configuration", () => {
  it("does not expose report submission pages in the miniapp", () => {
    expect(pagesConfig.pages.map((page) => page.path)).not.toContain("pages/reports/create");
  });

  it("exposes user asset list and publish pages in the miniapp", () => {
    const paths = pagesConfig.pages.map((page) => page.path);

    expect(paths).toContain("pages/auctions/publish");
    expect(paths).toContain("pages/profile/assets");
  });

  it("renders the custom tab bar labels with regular miniapp views", () => {
    const tabBarMarkup = readFileSync(
      resolve(import.meta.dirname, "../custom-tab-bar/index.wxml"),
      "utf8"
    );

    expect(tabBarMarkup).toContain('wx:for="{{list}}"');
    expect(tabBarMarkup).toContain("{{item.text}}");
    expect(tabBarMarkup).not.toContain("cover-view");
    expect(tabBarMarkup).not.toContain("cover-text");
  });
});
