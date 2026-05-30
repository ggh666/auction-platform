import { describe, expect, it } from "vitest";
import { firstAssetImageUrl } from "./asset-images";

describe("asset image helpers", () => {
  it("returns the first usable asset image URL", () => {
    expect(firstAssetImageUrl(["", "  ", "https://img.example.com/a.png"])).toBe("https://img.example.com/a.png");
  });

  it("returns null when an asset has no usable images", () => {
    expect(firstAssetImageUrl([])).toBeNull();
    expect(firstAssetImageUrl(["  "])).toBeNull();
  });
});
