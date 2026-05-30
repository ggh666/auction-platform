import { describe, expect, it } from "vitest";
import { TRADING_DISCLAIMER_MESSAGE, confirmTradingDisclaimer } from "./disclaimer";

describe("trading disclaimer", () => {
  it("uses the required risk disclaimer text", () => {
    expect(TRADING_DISCLAIMER_MESSAGE).toBe(
      "本平台仅提供信息交换，不涉及任何线上资金交易，请务必走游戏内安全交易渠道，线下转账风险自担"
    );
  });

  it("resolves true only when the user confirms", async () => {
    const confirmed = await confirmTradingDisclaimer((options) => {
      options.success?.({ confirm: true, cancel: false, errMsg: "showModal:ok" });
    });
    const cancelled = await confirmTradingDisclaimer((options) => {
      options.success?.({ confirm: false, cancel: true, errMsg: "showModal:ok" });
    });

    expect(confirmed).toBe(true);
    expect(cancelled).toBe(false);
  });
});
