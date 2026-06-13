import type { AssetConversation, AssetMessage, AuctionAsset, BidDisplayRecord } from "./domain";

export type AuctionWsEvent =
  | { type: "auction_snapshot"; asset: AuctionAsset; serverTime: string }
  | { type: "bid_accepted"; asset: AuctionAsset; bid: BidDisplayRecord; serverTime: string }
  | { type: "bid_revoked"; asset: AuctionAsset; bid: BidDisplayRecord; serverTime: string }
  | { type: "auction_extended"; asset: AuctionAsset; serverTime: string }
  | { type: "auction_ended"; asset: AuctionAsset; resultId: string | null; serverTime: string }
  | { type: "asset_removed"; assetId: string; serverTime: string }
  | { type: "asset_cancelled"; assetId: string; serverTime: string }
  | { type: "error"; code: string; message: string };

export type AssetMessageWsEvent =
  | {
      type: "asset_message_created";
      userId: string;
      principalId: string | null;
      targetUserId: string | null;
      conversationId: string;
      message: AssetMessage;
      serverTime: string;
    }
  | {
      type: "asset_conversation_updated";
      userId: string;
      principalId: string | null;
      targetUserId: string | null;
      conversation: AssetConversation;
      serverTime: string;
    }
  | { type: "error"; code: string; message: string };
