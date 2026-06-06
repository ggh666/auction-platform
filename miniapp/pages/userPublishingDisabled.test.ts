import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const miniappRoot = resolve(import.meta.dirname, "..");

function readPage(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp user publishing switch", () => {
  it("keeps user asset records visible and gates publishing through backend context", () => {
    const auctionListPage = readPage("pages/auctions/list.vue");
    const profilePage = readPage("pages/profile/index.vue");
    const pagesConfig = readPage("pages.json");

    expect(auctionListPage).not.toContain("openPublish");
    expect(auctionListPage).not.toContain("发布{{ selectedAssetType }}");
    expect(profilePage).toContain("我的资产");
    expect(profilePage).toContain("/pages/profile/assets");
    expect(pagesConfig).toContain("pages/auctions/publish");
    expect(pagesConfig).toContain("pages/profile/assets");
    const assetListPage = readPage("pages/profile/assets.vue");
    expect(assetListPage).toContain("getAssetPublishContext");
    expect(assetListPage).toContain("提交资产");
    expect(assetListPage).toContain("提交记录");
    expect(assetListPage).toContain("normalizeUserAssetSubmitDisabledReason");
    expect(assetListPage).toContain("const publishEnabled = ref(true)");
    expect(assetListPage).toContain("contextFailed");
    expect(assetListPage).toContain("发布状态获取失败，进入发布页后会再次校验");
    const publishPage = readPage("pages/auctions/publish.vue");
    expect(publishPage).toContain("createAsset");
    expect(publishPage).toContain("normalizeUserAssetSubmitDisabledReason");
    expect(publishPage).toContain("WeChat openid is required for content safety check");
    expect(publishPage).toContain("请重新登录后上传");
    expect(publishPage).not.toContain("特殊时期暂未开放用户发布资产");
  });
});
