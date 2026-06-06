import type { AssetMessageWsEvent } from "@auction/shared";
import { readToken } from "../auth/session";

export function messageWebSocketUrl(apiBase: string, token: string): string {
  const normalized = apiBase.trim().replace(/\/+$/, "");
  const match = normalized.match(/^(https?):\/\/([^/]+)/);
  const encodedToken = encodeURIComponent(token);
  if (!match) {
    return `/ws/messages?token=${encodedToken}`;
  }

  const protocol = match[1] === "https" ? "wss" : "ws";
  return `${protocol}://${match[2]}/ws/messages?token=${encodedToken}`;
}

export type MessageSocketMessage = {
  data: string | ArrayBuffer;
};

export type MessageSocketTask = {
  close?: (options?: object) => void;
  onClose?: (handler: () => void) => void;
  onError?: (handler: () => void) => void;
  onOpen?: (handler: () => void) => void;
  onMessage?: (handler: (message: MessageSocketMessage) => void) => void;
};

export function connectMessageSocket(input: {
  apiBase: string;
  connectSocket: (input: { url: string }) => MessageSocketTask | null | undefined;
  onEvent: (event: AssetMessageWsEvent) => void;
  onClose?: () => void;
  onError?: () => void;
  onOpen?: () => void;
}): MessageSocketTask | null {
  const token = readToken();
  if (!token) {
    return null;
  }
  let socket: MessageSocketTask | null | undefined;
  try {
    socket = input.connectSocket({ url: messageWebSocketUrl(input.apiBase, token) });
  } catch {
    return null;
  }
  if (!socket || typeof socket.onMessage !== "function") {
    return null;
  }
  socket.onOpen?.(() => input.onOpen?.());
  socket.onClose?.(() => input.onClose?.());
  socket.onError?.(() => input.onError?.());
  socket.onMessage((message) => {
    if (typeof message.data !== "string") {
      return;
    }
    try {
      input.onEvent(JSON.parse(message.data) as AssetMessageWsEvent);
    } catch {
      // Ignore malformed realtime messages; API refresh remains the fallback.
    }
  });
  return socket;
}
