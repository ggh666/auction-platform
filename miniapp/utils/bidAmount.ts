import { centsToYuanText, parseYuanToCents, type AssetStatus } from "@auction/shared";
import { restrictedActionFailureMessage } from "./userActionErrors";

type BidAsset = {
  startingPriceCents: number;
  currentPriceCents: number | null;
  minIncrementCents: number;
};

type AuctionAvailabilityAsset = {
  status: AssetStatus;
  effectiveEndAt: string;
};

export type BidAmountValidation =
  | { ok: true; amountCents: number }
  | { ok: false; message: string };

export function requiredBidCents(asset: BidAsset): number {
  return asset.currentPriceCents === null ? asset.startingPriceCents : asset.currentPriceCents + asset.minIncrementCents;
}

export function validateBidAmountYuan(input: string, asset: BidAsset): BidAmountValidation {
  let amountCents: number;
  try {
    amountCents = parseYuanToCents(input);
  } catch {
    return { ok: false, message: "请输入有效出价" };
  }

  const requiredCents = requiredBidCents(asset);
  if (amountCents < requiredCents) {
    return { ok: false, message: `出价不能低于 ${centsToYuanText(requiredCents)} 元` };
  }

  return { ok: true, amountCents };
}

export function auctionUnavailableMessage(asset: AuctionAvailabilityAsset, now = new Date()): string | null {
  if (asset.status === "removed") {
    return "该资产已下架，无法继续出价";
  }
  if (asset.status === "cancelled") {
    return "该资产已取消，无法继续出价";
  }
  if (asset.status === "ended") {
    return "交换已结束，无法出价";
  }
  if (asset.status !== "active") {
    return "该资产暂不可出价";
  }

  const endMs = new Date(asset.effectiveEndAt).getTime();
  if (!Number.isFinite(endMs) || now.getTime() >= endMs) {
    return "交换已结束，无法出价";
  }

  return null;
}

export function bidFailureMessage(error: unknown, requiredCents: number): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "Authentication required" || message === "User token required") {
    return "请先登录后再出价";
  }
  const restrictedMessage = restrictedActionFailureMessage(error, "bid", "");
  if (restrictedMessage) {
    return restrictedMessage;
  }
  if (message === "Seller cannot bid on own asset") {
    return "不能给自己的资产出价";
  }
  if (message === "Auction already ended") {
    return "交换已结束，无法出价";
  }
  if (message === "Asset is not active") {
    return "该资产暂不可出价";
  }
  if (message === "Bid does not satisfy current price and increment") {
    return `出价不能低于 ${centsToYuanText(requiredCents)} 元`;
  }

  return message || "出价失败，请确认登录和金额";
}
