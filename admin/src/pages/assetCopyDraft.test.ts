import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appPath = resolve(import.meta.dirname, "../App.tsx");
const assetDataPath = resolve(import.meta.dirname, "AssetDataPage.tsx");
const assetPublishPath = resolve(import.meta.dirname, "AssetPublishPage.tsx");

describe("admin asset copy draft flow", () => {
  it("lets admins copy an asset from the asset list into the publish editor", () => {
    const app = readFileSync(appPath, "utf8");
    const assetData = readFileSync(assetDataPath, "utf8");
    const assetPublish = readFileSync(assetPublishPath, "utf8");

    expect(assetData).toContain("复制");
    expect(assetData).toContain("onCopyAsset");
    expect(app).toContain("/copy-draft");
    expect(app).toContain("assetPublishDraft");
    expect(app).toContain("setPage(\"assetPublish\")");
    expect(assetPublish).toContain("copyDraft");
    expect(assetPublish).toContain("复制资产");
    expect(assetPublish).toContain("setPublishImages(copyDraft.images");
  });
});
