import { describe, expect, it } from "vitest";
import { missingDragonBallFieldMessage, missingUserAssetBaseFieldMessage } from "./assetPublishValidation";

describe("miniapp user asset publish validation copy", () => {
  it("points to the exact missing base field instead of listing every required field", () => {
    expect(
      missingUserAssetBaseFieldMessage({
        gameName: "塔防精灵",
        serverName: "17区",
        title: "龙珠资源",
        description: ""
      })
    ).toBe("请填写描述");
  });

  it("lists only the missing base fields when more than one is empty", () => {
    expect(
      missingUserAssetBaseFieldMessage({
        gameName: "塔防精灵",
        serverName: " ",
        title: "",
        description: "补充说明"
      })
    ).toBe("请填写区服、标题");
  });

  it("points to the exact missing dragon ball field", () => {
    expect(
      missingDragonBallFieldMessage({
        profession: "战士",
        quality: "红",
        attributes: " "
      })
    ).toBe("请填写龙珠属性");
  });
});
