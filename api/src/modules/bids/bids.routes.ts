import { isWholeYuanCents, type PlaceBidRequest, type PlaceBidResponse } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireActiveUser } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import type { AuctionHub } from "../../realtime/auctionHub";
import type { AssetsRepository } from "../assets/assets.repository";
import type { NotificationsRepository } from "../notifications/notifications.repository";
import type { SubscribeMessageService } from "../subscribeMessages/subscribeMessage.service";
import { toBidDisplayRecord } from "../users/userSummary";
import type { UsersRepository } from "../users/users.repository";
import type { BidsRepository } from "./bids.repository";
import { createBidsService } from "./bids.service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return isWholeYuanCents(value) && value > 0;
}

function parsePlaceBidRequest(body: unknown): PlaceBidRequest {
  if (!isRecord(body)) {
    throw badRequest("invalid_bid", "Bid payload is invalid");
  }

  const assetId = body.assetId;
  const amountCents = body.amountCents;
  if (typeof assetId !== "string" || assetId.trim().length === 0) {
    throw badRequest("invalid_asset_id", "assetId is required");
  }
  if (!isPositiveSafeInteger(amountCents)) {
    throw badRequest("invalid_bid_amount", "amountCents must be a positive whole amount");
  }
  if (body.commitmentAccepted !== true) {
    throw badRequest("bid_commitment_required", "Bid commitment must be accepted");
  }

  return { assetId: assetId.trim(), amountCents, commitmentAccepted: true };
}

function bidRestrictionDetails(user: Awaited<ReturnType<UsersRepository["findById"]>>) {
  if (!user?.bid_restricted_until) {
    return null;
  }
  const restrictedUntil = new Date(user.bid_restricted_until);
  if (Number.isNaN(restrictedUntil.getTime()) || restrictedUntil.getTime() <= Date.now()) {
    return null;
  }
  return {
    buyerUnreachableCount: user.buyer_unreachable_count,
    bidRestrictedUntil: restrictedUntil.toISOString()
  };
}

export function registerBidRoutes(
  app: FastifyInstance,
  deps: {
    assets: AssetsRepository;
    bids: BidsRepository;
    hub: Pick<AuctionHub, "publish">;
    users: UsersRepository;
    notifications: NotificationsRepository;
    subscribeMessages: SubscribeMessageService;
  }
): void {
  const service = createBidsService({
    assets: deps.assets,
    bids: deps.bids,
    extensionWindowSeconds: 300,
    extensionDurationSeconds: 300
  });

  app.post<{ Body: unknown; Reply: PlaceBidResponse }>("/api/bids", { preHandler: requireActiveUser(deps.users) }, async (request) => {
    if (!request.user?.id) {
      throw new HttpError(401, "unauthorized", "Authentication required");
    }

    const body = parsePlaceBidRequest(request.body);
    const user = await deps.users.findById(Number(request.user.id));
    const restriction = bidRestrictionDetails(user);
    if (restriction) {
      throw new HttpError(403, "bid_restricted", "User is temporarily restricted from bidding", restriction);
    }
    const result = await service.placeBid(request.user.id, body.assetId, body.amountCents);
    const bid = await toBidDisplayRecord(deps.users, result.bid);
    const serverTime = new Date().toISOString();

    deps.hub.publish(result.asset.id, {
      type: "bid_accepted",
      asset: result.asset,
      bid,
      serverTime
    });
    if (result.extended) {
      deps.hub.publish(result.asset.id, {
        type: "auction_extended",
        asset: result.asset,
        serverTime
      });
    }

    const allBids = await deps.bids.listByAsset(result.asset.id);
    const previousAmountByBidderId = new Map<string, number>();
    for (const existingBid of allBids) {
      if (existingBid.id === result.bid.id) {
        continue;
      }
      previousAmountByBidderId.set(existingBid.bidderId, existingBid.amountCents);
    }
    const recipientIds = [...new Set(allBids.map((existingBid) => existingBid.bidderId))]
      .filter((bidderId) => bidderId !== request.user.id);
    let createdNotifications: Awaited<ReturnType<NotificationsRepository["createMany"]>> = [];
    try {
      createdNotifications = await deps.notifications.createMany(
        recipientIds.map((userId) => ({
          userId,
          type: "outbid",
          assetId: result.asset.id,
          bidId: result.bid.id,
          actorUserId: request.user.id,
          actorDisplayName: bid.bidder.displayName,
          assetTitle: result.asset.title,
          amountCents: result.bid.amountCents
        }))
      );
    } catch (error) {
      request.log.error({ err: error }, "failed to create bid notifications");
    }

    for (const notification of createdNotifications) {
      try {
        const recipient = await deps.users.findById(Number(notification.userId));
        await deps.subscribeMessages.sendPriceChange({
          touserOpenid: recipient?.openid ?? null,
          assetId: notification.assetId,
          assetTitle: notification.assetTitle,
          previousAmountCents: previousAmountByBidderId.get(notification.userId) ?? notification.amountCents,
          amountCents: notification.amountCents,
          actorDisplayName: notification.actorDisplayName,
          changedAt: notification.createdAt
        });
      } catch (error) {
        request.log.error({ err: error, notificationId: notification.id }, "failed to send price change subscribe message");
      }
    }

    return { ...result, bid };
  });
}
