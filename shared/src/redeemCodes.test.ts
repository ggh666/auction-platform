import { describe, expect, it } from "vitest";
import { parseRedeemCodeText } from "./redeemCodes";

describe("redeem code text parsing", () => {
  it("parses pipe-separated code, description, and validity rows while ignoring blanks", () => {
    expect(parseRedeemCodeText("TFJL520|随机金卡|永久\n\n XCKL666 | 随机全卡 | 2026-12-31 ")).toEqual([
      { code: "TFJL520", description: "随机金卡", validity: "永久" },
      { code: "XCKL666", description: "随机全卡", validity: "2026-12-31" }
    ]);
  });

  it("rejects rows without exactly three non-empty fields", () => {
    expect(() => parseRedeemCodeText("TFJL520|随机金卡")).toThrow("第 1 行");
    expect(() => parseRedeemCodeText("TFJL520||永久")).toThrow("第 1 行");
  });

  it("rejects duplicate redeem codes", () => {
    expect(() => parseRedeemCodeText("TFJL520|随机金卡|永久\nTFJL520|随机紫卡|永久")).toThrow("兑换码重复");
  });

  it("rejects fields that exceed the display limits", () => {
    expect(() => parseRedeemCodeText(`${"A".repeat(65)}|随机金卡|永久`)).toThrow("兑换码过长");
    expect(() => parseRedeemCodeText(`TFJL520|${"奖".repeat(121)}|永久`)).toThrow("奖励说明过长");
    expect(() => parseRedeemCodeText(`TFJL520|随机金卡|${"效".repeat(41)}`)).toThrow("效期过长");
  });

  it("allows an empty setting", () => {
    expect(parseRedeemCodeText("\n  \n")).toEqual([]);
  });
});
