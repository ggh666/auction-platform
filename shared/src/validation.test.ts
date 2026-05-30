import { describe, expect, it } from "vitest";
import { canBidAmount, shouldExtendAuction } from "./validation";

describe("auction validation", () => {
  it("accepts the first bid at the starting price", () => {
    expect(canBidAmount({ amountCents: 1000, startingPriceCents: 1000, currentPriceCents: null, minIncrementCents: 100 })).toBe(true);
  });

  it("rejects a later bid below current price plus increment", () => {
    expect(canBidAmount({ amountCents: 1050, startingPriceCents: 1000, currentPriceCents: 1000, minIncrementCents: 100 })).toBe(false);
  });

  it("accepts a later bid exactly at current price plus increment", () => {
    expect(canBidAmount({ amountCents: 1100, startingPriceCents: 1000, currentPriceCents: 1000, minIncrementCents: 100 })).toBe(true);
  });

  it("rejects a later bid just below current price plus increment", () => {
    expect(canBidAmount({ amountCents: 1099, startingPriceCents: 1000, currentPriceCents: 1000, minIncrementCents: 100 })).toBe(false);
  });

  it("rejects invalid monetary bid inputs", () => {
    expect(canBidAmount({ amountCents: 1000, startingPriceCents: 1000, currentPriceCents: 1000, minIncrementCents: 0 })).toBe(false);
    expect(canBidAmount({ amountCents: 1000, startingPriceCents: 0, currentPriceCents: null, minIncrementCents: 100 })).toBe(false);
    expect(canBidAmount({ amountCents: 1100, startingPriceCents: 1000, currentPriceCents: 1.5, minIncrementCents: 100 })).toBe(false);
  });

  it("extends when a bid lands inside the extension window", () => {
    expect(shouldExtendAuction({
      bidAt: new Date("2026-05-22T10:58:00.000Z"),
      effectiveEndAt: new Date("2026-05-22T11:00:00.000Z"),
      extensionWindowSeconds: 300
    })).toBe(true);
  });

  it("extends when a bid lands exactly at the extension boundary", () => {
    expect(shouldExtendAuction({
      bidAt: new Date("2026-05-22T10:55:00.000Z"),
      effectiveEndAt: new Date("2026-05-22T11:00:00.000Z"),
      extensionWindowSeconds: 300
    })).toBe(true);
  });

  it("does not extend when a bid lands just outside the extension boundary", () => {
    expect(shouldExtendAuction({
      bidAt: new Date("2026-05-22T10:54:59.999Z"),
      effectiveEndAt: new Date("2026-05-22T11:00:00.000Z"),
      extensionWindowSeconds: 300
    })).toBe(false);
  });

  it("does not extend when a bid lands after the auction end", () => {
    expect(shouldExtendAuction({
      bidAt: new Date("2026-05-22T11:00:00.001Z"),
      effectiveEndAt: new Date("2026-05-22T11:00:00.000Z"),
      extensionWindowSeconds: 300
    })).toBe(false);
  });

  it("does not extend for a negative extension window", () => {
    expect(shouldExtendAuction({
      bidAt: new Date("2026-05-22T10:58:00.000Z"),
      effectiveEndAt: new Date("2026-05-22T11:00:00.000Z"),
      extensionWindowSeconds: -1
    })).toBe(false);
  });
});
