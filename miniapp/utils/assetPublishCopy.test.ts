import { describe, expect, it } from "vitest";
import { normalizeUserAssetSubmitDisabledReason, USER_ASSET_SUBMIT_DISABLED_REASON } from "./assetPublishCopy";

describe("miniapp user asset publish copy", () => {
  it("normalizes legacy publish-disabled wording to submit wording", () => {
    expect(normalizeUserAssetSubmitDisabledReason("特殊时期暂未开放用户发布资产")).toBe(USER_ASSET_SUBMIT_DISABLED_REASON);
    expect(normalizeUserAssetSubmitDisabledReason("暂未开放用户发布资产")).toBe(USER_ASSET_SUBMIT_DISABLED_REASON);
  });

  it("keeps custom non-legacy disabled reasons", () => {
    expect(normalizeUserAssetSubmitDisabledReason("系统维护中")).toBe("系统维护中");
  });

  it("uses the current default when the reason is empty", () => {
    expect(normalizeUserAssetSubmitDisabledReason(null)).toBe(USER_ASSET_SUBMIT_DISABLED_REASON);
    expect(normalizeUserAssetSubmitDisabledReason(" ")).toBe(USER_ASSET_SUBMIT_DISABLED_REASON);
  });
});
