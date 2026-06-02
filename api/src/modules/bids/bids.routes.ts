import { isWholeYuanCents, type PlaceBidRequest, type PlaceBidResponse } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireActiveUser } from "../../http/auth";
import { HttpError, badRequest } from "../../http/errors";
import type { AuctionHub } from "../../realtime/auctionHub";
import type { AssetsRepository } from "../assets/assets.repository";
import { toPublicAsset } from "../assets/publicAsset";
import type { NotificationsRepository } from "../notifications/notifications.repository";
import { createInProcessPriceChangeQueue } from "../subscribeMessages/priceChangeQueue";
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
  const priceChangeQueue = createInProcessPriceChangeQueue({
    users: deps.users,
    subscribeMessages: deps.subscribeMessages,
    log: app.log
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
    const publicAsset = toPublicAsset(result.asset);
    const serverTime = new Date().toISOString();

    deps.hub.publish(result.asset.id, {
      type: "bid_accepted",
      asset: publicAsset,
      bid,
      serverTime
    });
    if (result.extended) {
      deps.hub.publish(result.asset.id, {
        type: "auction_extended",
        asset: publicAsset,
        serverTime
      });
    }

    const latestBidsByBidder = await deps.bids.listLatestByAssetBidders(result.asset.id);
    const priorRecipientBids = latestBidsByBidder.filter(
      (existingBid) => existingBid.id !== result.bid.id && existingBid.bidderId !== request.user.id
    );
    const previousAmountByBidderId = new Map(priorRecipientBids.map((existingBid) => [existingBid.bidderId, existingBid.amountCents]));
    let createdNotifications: Awaited<ReturnType<NotificationsRepository["createMany"]>> = [];
    try {
      createdNotifications = await deps.notifications.createMany(
        priorRecipientBids.map((existingBid) => ({
          userId: existingBid.bidderId,
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
      priceChangeQueue.enqueue({
        notificationId: notification.id,
        userId: notification.userId,
        assetId: notification.assetId,
        assetTitle: notification.assetTitle,
        previousAmountCents: previousAmountByBidderId.get(notification.userId) ?? notification.amountCents,
        amountCents: notification.amountCents,
        actorDisplayName: notification.actorDisplayName,
        changedAt: notification.createdAt
      });
    }

    return { ...result, asset: publicAsset, bid };
  });
}
