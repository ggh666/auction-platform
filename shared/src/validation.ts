import { isWholeYuanCents } from "./money";

function isPositiveSafeInteger(value: number): boolean {
  return isWholeYuanCents(value) && value > 0;
}

export function canBidAmount(input: {
  amountCents: number;
  startingPriceCents: number;
  currentPriceCents: number | null;
  minIncrementCents: number;
}): boolean {
  if (
    !isPositiveSafeInteger(input.amountCents) ||
    !isPositiveSafeInteger(input.startingPriceCents) ||
    !isPositiveSafeInteger(input.minIncrementCents) ||
    (input.currentPriceCents !== null && !isPositiveSafeInteger(input.currentPriceCents))
  ) {
    return false;
  }

  if (input.currentPriceCents === null) {
    return input.amountCents >= input.startingPriceCents;
  }

  return input.amountCents >= input.currentPriceCents + input.minIncrementCents;
}

export function shouldExtendAuction(input: {
  bidAt: Date;
  effectiveEndAt: Date;
  extensionWindowSeconds: number;
}): boolean {
  if (!Number.isSafeInteger(input.extensionWindowSeconds) || input.extensionWindowSeconds < 0) {
    return false;
  }

  const extensionWindowMs = input.extensionWindowSeconds * 1000;
  if (!Number.isSafeInteger(extensionWindowMs)) {
    return false;
  }

  const millisecondsUntilEnd = input.effectiveEndAt.getTime() - input.bidAt.getTime();
  return Number.isFinite(millisecondsUntilEnd) && millisecondsUntilEnd >= 0 && millisecondsUntilEnd <= extensionWindowMs;
}
