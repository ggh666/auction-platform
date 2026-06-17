import { describe, expect, it } from "vitest";
import {
  buildAssetDetailShare,
  buildDeepSeaBattleShare,
  buildDeepSeaBossShare,
  buildDragonBallSystemShare,
  buildAssetListShare,
  buildExchangeResourceDetailShare,
  buildExchangeResourceListShare,
  buildGameModeShare,
  buildGuidesShare,
  buildHomeShare,
  buildPriceReferenceShare,
  buildRedeemCodesShare,
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

  it("builds game mode and free exchange list share targets", () => {
    expect(buildGameModeShare({ gameName: "塔防精灵" })).toEqual({
      title: "塔防精灵交换方式",
      path: "/pages/games/mode?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5"
    });
    expect(
      buildExchangeResourceListShare({
        gameName: "塔防精灵",
        dragonBallProfession: "法师",
        dragonBallQuality: "蓝",
        keyword: "17区"
      })
    ).toEqual({
      title: "塔防精灵龙珠自由交换",
      path: "/pages/exchange/list?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&dragonBallProfession=%E6%B3%95%E5%B8%88&dragonBallQuality=%E8%93%9D&keyword=17%E5%8C%BA"
    });
  });

  it("builds a price reference share target with selected profession and quality", () => {
    expect(
      buildPriceReferenceShare({
        gameName: "塔防精灵",
        profession: "法师",
        quality: "蓝"
      })
    ).toEqual({
      title: "塔防精灵龙珠估值参考",
      path: "/pages/priceReference/index?gameName=%E5%A1%94%E9%98%B2%E7%B2%BE%E7%81%B5&profession=%E6%B3%95%E5%B8%88&quality=%E8%93%9D"
    });
  });

  it("builds guides and redeem code share targets", () => {
    expect(buildGuidesShare()).toEqual({
      title: "塔防精灵攻略工具",
      path: "/pages/guides/index"
    });
    expect(buildRedeemCodesShare()).toEqual({
      title: "塔防精灵兑换码",
      path: "/pages/guides/redeem-codes"
    });
    expect(buildDragonBallSystemShare()).toEqual({
      title: "塔防精灵龙珠体系",
      path: "/pages/guides/dragon-ball-system"
    });
    expect(buildDeepSeaBattleShare()).toEqual({
      title: "塔防精灵深海之战",
      path: "/pages/guides/deep-sea-battle"
    });
    expect(buildDeepSeaBossShare({ section: 4, level: 80 })).toEqual({
      title: "深海之战·乌贼80关",
      path: "/pages/guides/deep-sea-boss?section=4&level=80"
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

  it("builds an exchange resource detail share target", () => {
    expect(
      buildExchangeResourceDetailShare({
        resourceId: "88",
        title: "红品质龙珠交换",
        gameName: "塔防精灵",
        imageUrl: "https://cdn.example.com/exchange.jpg"
      })
    ).toEqual({
      title: "红品质龙珠交换 - 塔防精灵自由交换",
      path: "/pages/exchange/detail?resourceId=88",
      imageUrl: "https://cdn.example.com/exchange.jpg"
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
