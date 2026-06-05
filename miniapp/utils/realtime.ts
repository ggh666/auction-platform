import type { AuctionWsEvent } from "@auction/shared";

export function auctionWebSocketUrl(apiBase: string, assetId: string): string {
  const normalized = apiBase.trim().replace(/\/+$/, "");
  const match = normalized.match(/^(https?):\/\/([^/]+)/);
  if (!match) {
    return `/ws/auctions?assetId=${encodeURIComponent(assetId)}`;
  }

  const protocol = match[1] === "https" ? "wss" : "ws";
  return `${protocol}://${match[2]}/ws/auctions?assetId=${encodeURIComponent(assetId)}`;
}

export type AuctionSocketMessage = {
  data: string | ArrayBuffer;
};

export type AuctionSocketTask = {
  close?: (options?: object) => void;
  onClose?: (handler: () => void) => void;
  onError?: (handler: () => void) => void;
  onOpen?: (handler: () => void) => void;
  onMessage?: (handler: (message: AuctionSocketMessage) => void) => void;
};

type ConnectAuctionSocketInput = {
  apiBase: string;
  assetId: string;
  connectSocket: (input: { url: string }) => AuctionSocketTask | null | undefined;
  onEvent: (event: AuctionWsEvent) => void;
  onClose?: () => void;
  onError?: () => void;
  onOpen?: () => void;
};

export function connectAuctionSocket(input: ConnectAuctionSocketInput): AuctionSocketTask | null {
  if (!input.assetId) {
    return null;
  }

  let socket: AuctionSocketTask | null | undefined;
  try {
    socket = input.connectSocket({
      url: auctionWebSocketUrl(input.apiBase, input.assetId)
    });
  } catch {
    return null;
  }

  if (!socket || typeof socket.onMessage !== "function") {
    return null;
  }

  socket.onOpen?.(() => {
    input.onOpen?.();
  });
  socket.onClose?.(() => {
    input.onClose?.();
  });
  socket.onError?.(() => {
    input.onError?.();
  });
  socket.onMessage((message) => {
    if (typeof message.data !== "string") {
      return;
    }
    try {
      input.onEvent(JSON.parse(message.data) as AuctionWsEvent);
    } catch {
      // Ignore malformed realtime payloads; regular API refresh remains the fallback.
    }
  });
  return socket;
}
