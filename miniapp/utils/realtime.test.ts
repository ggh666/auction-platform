import { describe, expect, it } from "vitest";
import { auctionWebSocketUrl, connectAuctionSocket, type AuctionSocketMessage } from "./realtime";

describe("miniapp realtime helpers", () => {
  it("builds a secure auction websocket URL from an https API base", () => {
    expect(auctionWebSocketUrl("https://api-auction.toolmatrix.top", "42")).toBe(
      "wss://api-auction.toolmatrix.top/ws/auctions?assetId=42"
    );
  });

  it("builds a local websocket URL from an http API base", () => {
    expect(auctionWebSocketUrl("http://127.0.0.1:3002/api", "asset id")).toBe(
      "ws://127.0.0.1:3002/ws/auctions?assetId=asset%20id"
    );
  });

  it("does not throw when websocket creation fails", () => {
    const socket = connectAuctionSocket({
      apiBase: "https://api-auction.toolmatrix.top",
      assetId: "42",
      connectSocket() {
        throw new Error("socket unavailable");
      },
      onEvent() {
        throw new Error("should not receive events");
      }
    });

    expect(socket).toBeNull();
  });

  it("ignores websocket tasks that cannot register messages", () => {
    const socket = connectAuctionSocket({
      apiBase: "https://api-auction.toolmatrix.top",
      assetId: "42",
      connectSocket() {
        return {};
      },
      onEvent() {
        throw new Error("should not receive events");
      }
    });

    expect(socket).toBeNull();
  });

  it("parses string websocket messages and ignores malformed payloads", () => {
    let onMessage: ((message: AuctionSocketMessage) => void) | null = null;
    const events: Array<{ type: string }> = [];
    const socket = connectAuctionSocket({
      apiBase: "https://api-auction.toolmatrix.top",
      assetId: "42",
      connectSocket() {
        return {
          onMessage(handler) {
            onMessage = handler;
          }
        };
      },
      onEvent(event) {
        events.push({ type: event.type });
      }
    });

    expect(socket).not.toBeNull();
    onMessage?.({ data: "{not-json" });
    onMessage?.({ data: JSON.stringify({ type: "auction_extended", asset: { id: "42" } }) });
    expect(events).toEqual([{ type: "auction_extended" }]);
  });

  it("registers optional websocket lifecycle handlers", () => {
    let onOpen: (() => void) | null = null;
    let onClose: (() => void) | null = null;
    let onError: (() => void) | null = null;
    const lifecycleEvents: string[] = [];

    const socket = connectAuctionSocket({
      apiBase: "https://api-auction.toolmatrix.top",
      assetId: "42",
      connectSocket() {
        return {
          onMessage() {
            // no-op
          },
          onOpen(handler) {
            onOpen = handler;
          },
          onClose(handler) {
            onClose = handler;
          },
          onError(handler) {
            onError = handler;
          }
        };
      },
      onEvent() {
        throw new Error("should not receive events");
      },
      onOpen() {
        lifecycleEvents.push("open");
      },
      onClose() {
        lifecycleEvents.push("close");
      },
      onError() {
        lifecycleEvents.push("error");
      }
    });

    expect(socket).not.toBeNull();
    onOpen?.();
    onError?.();
    onClose?.();
    expect(lifecycleEvents).toEqual(["open", "error", "close"]);
  });
});
