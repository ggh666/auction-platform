import { describe, expect, it } from "vitest";
import { normalizeAssetType } from "./assetType";

describe("miniapp asset type query parsing", () => {
  it("keeps item list query values on the item asset type", () => {
    expect(normalizeAssetType(encodeURIComponent("道具"))).toBe("道具");
  });
});
