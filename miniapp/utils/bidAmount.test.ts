import { describe, expect, it } from "vitest";
import {
  auctionUnavailableMessage,
  bidFailureMessage,
  bidderAlreadyHighestMessage,
  requiredBidCents,
  validateBidAmountYuan
} from "./bidAmount";

const asset = {
  startingPriceCents: 10000,
  currentPriceCents: null,
  minIncrementCents: 100,
  status: "active",
  effectiveEndAt: "2026-05-26T12:30:00.000Z"
};

describe("miniapp bid amount helpers", () => {
  it("uses the starting price as the first required bid", () => {
    expect(requiredBidCents(asset)).toBe(10000);
  });

  it("uses current price plus minimum increment after bidding starts", () => {
    expect(requiredBidCents({ ...asset, currentPriceCents: 10000 })).toBe(10100);
  });

  it("rejects bid amounts below the required price before submitting", () => {
    expect(validateBidAmountYuan("100.99", { ...asset, currentPriceCents: 10000 })).toEqual({
      ok: false,
      message: "出价不能低于 101.00 元"
    });
  });

  it("accepts bid amounts exactly at the required price", () => {
    expect(validateBidAmountYuan("101", { ...asset, currentPriceCents: 10000 })).toEqual({
      ok: true,
      amountCents: 10100
    });
  });

  it("maps backend bid failures to miniapp friendly messages", () => {
    expect(bidFailureMessage(new Error("Seller cannot bid on own asset"), 10100)).toBe("不能给自己的资产出价");
    expect(bidFailureMessage(new Error("Current highest bidder cannot bid again"), 10100)).toBe(
      "当前最高出价已经是你，无需重复提交"
    );
    expect(bidFailureMessage(new Error("Bid does not satisfy current price and increment"), 10100)).toBe(
      "出价不能低于 101.00 元"
    );
  });

  it("blocks the current highest bidder before submitting", () => {
    expect(bidderAlreadyHighestMessage({ highestBidderId: "2" }, "2")).toBe("当前最高出价已经是你，无需重复提交");
    expect(bidderAlreadyHighestMessage({ highestBidderId: "2" }, "3")).toBeNull();
    expect(bidderAlreadyHighestMessage({ highestBidderId: null }, "2")).toBeNull();
  });

  it("marks removed assets as unavailable for bidding", () => {
    expect(
      auctionUnavailableMessage(
        { ...asset, status: "removed" },
        new Date("2026-05-26T12:00:00.000Z")
      )
    ).toBe("该资产已下架，无法继续出价");
  });

  it("marks time-expired active assets as unavailable for bidding", () => {
    expect(auctionUnavailableMessage(asset, new Date("2026-05-26T12:30:00.000Z"))).toBe("交换已结束，无法出价");
  });
});
