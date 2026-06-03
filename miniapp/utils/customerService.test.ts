import { describe, expect, it } from "vitest";
import {
  buildAssetCustomerServiceContact,
  buildFollowupCustomerServiceContact,
  buildProfileCustomerServiceContact
} from "./customerService";

describe("customer service contact helpers", () => {
  it("builds a profile customer service entry without a message card", () => {
    const contact = buildProfileCustomerServiceContact({ userId: "9" });

    expect(contact).toEqual({
      sessionFrom: "source=profile&userId=9",
      sendMessageTitle: "平台客服",
      sendMessagePath: "/pages/profile/index",
      sendMessageImg: "",
      showMessageCard: false
    });
  });

  it("builds asset detail context and a shareable asset card", () => {
    const contact = buildAssetCustomerServiceContact({
      userId: "12",
      asset: {
        id: "88",
        title: "塔防精灵账号",
        principalId: "5",
        imageUrls: [" https://static.example.com/asset.png "]
      }
    });

    expect(contact).toEqual({
      sessionFrom: "source=asset_detail&userId=12&assetId=88&principalId=5",
      sendMessageTitle: "咨询：塔防精灵账号",
      sendMessagePath: "/pages/auctions/detail?assetId=88",
      sendMessageImg: "https://static.example.com/asset.png",
      showMessageCard: true
    });
  });

  it("builds deal followup context and omits empty fields", () => {
    const contact = buildFollowupCustomerServiceContact({
      userId: "12",
      followup: {
        id: "77",
        assetId: "88",
        principalId: null,
        assetTitle: "成交宝贝",
        imageUrl: ""
      }
    });

    expect(contact).toEqual({
      sessionFrom: "source=deal_followup&userId=12&assetId=88&followupId=77",
      sendMessageTitle: "成交沟通：成交宝贝",
      sendMessagePath: "/pages/profile/results?assetId=88",
      sendMessageImg: "",
      showMessageCard: true
    });
  });

  it("keeps session-from stable and truncates long message titles", () => {
    const contact = buildAssetCustomerServiceContact({
      userId: "7",
      asset: {
        id: "",
        title: "超长标题".repeat(20),
        principalId: null,
        imageUrls: ["", "   "]
      }
    });

    expect(contact.sessionFrom).toBe("source=asset_detail&userId=7");
    expect(contact.sendMessageTitle.length).toBeLessThanOrEqual(48);
    expect(contact.sendMessageTitle.endsWith("...")).toBe(true);
    expect(contact.sendMessagePath).toBe("/pages/profile/index");
    expect(contact.sendMessageImg).toBe("");
  });
});
