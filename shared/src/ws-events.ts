import type { AuctionAsset, BidDisplayRecord } from "./domain";

export type AuctionWsEvent =
  | { type: "auction_snapshot"; asset: AuctionAsset; serverTime: string }
  | { type: "bid_accepted"; asset: AuctionAsset; bid: BidDisplayRecord; serverTime: string }
  | { type: "bid_revoked"; asset: AuctionAsset; bid: BidDisplayRecord; serverTime: string }
  | { type: "auction_extended"; asset: AuctionAsset; serverTime: string }
  | { type: "auction_ended"; asset: AuctionAsset; resultId: string | null; serverTime: string }
  | { type: "asset_removed"; assetId: string; serverTime: string }
  | { type: "asset_cancelled"; assetId: string; serverTime: string }
  | { type: "error"; code: string; message: string };
