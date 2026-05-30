import { describe, expect, it } from "vitest";
import {
  buildAssetDetailShare,
  buildAssetListShare,
  buildHomeShare,
  toTimelineShare
} from "./share";

describe("miniapp share helpers", () => {
  it("builds a home share target", () => {
    expect(buildHomeShare()).toEqual({
      title: "塔防精灵账号与道具交换",
      path: "/pages/games/index"
    });
  });

  it("builds an encoded asset list share target", () => {
    expect(buildAssetListShare({ gameName: "塔防精灵", assetType: "道具", keyword: "17区" })).toEqual({
      title: "塔防精灵道具交换",
      path: "/pages/auctions/list?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E9%81%93%E5%85%B7&keyword=17%E5%8C%BA"
    });
  });

  it("builds an asset detail share target with the first usable image", () => {
    expect(
      buildAssetDetailShare({
        assetId: "12",
        title: "成品账号",
        gameName: "塔防精灵",
        imageUrls: [" ", "https://cdn.example.com/a.jpg"]
      })
    ).toEqual({
      title: "成品账号 - 塔防精灵交换",
      path: "/pages/auctions/detail?assetId=12",
      imageUrl: "https://cdn.example.com/a.jpg"
    });
  });

  it("converts page path share data to timeline share data", () => {
    expect(
      toTimelineShare({
        title: "塔防精灵道具交换",
        path: "/pages/auctions/list?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E9%81%93%E5%85%B7",
        imageUrl: "https://cdn.example.com/a.jpg"
      })
    ).toEqual({
      title: "塔防精灵道具交换",
      query: "gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&assetType=%E9%81%93%E5%85%B7",
      imageUrl: "https://cdn.example.com/a.jpg"
    });
  });
});
