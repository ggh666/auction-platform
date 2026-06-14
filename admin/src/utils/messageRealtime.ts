import type { AssetMessageWsEvent } from "@auction/shared";
import { readAdminToken } from "../auth/session";
import { resolveAdminApiBase } from "../api/client";

export type AdminMessageSocket = {
  close(): void;
};

export function adminMessageWebSocketUrl(apiBase: string, token: string): string {
  const normalized = apiBase.trim().replace(/\/+$/, "");
  const match = normalized.match(/^(https?):\/\/([^/]+)/);
  const protocol = match?.[1] === "https" ? "wss" : "ws";
  const host = match?.[2] ?? normalized;
  return `${protocol}://${host}/ws/messages?token=${encodeURIComponent(token)}`;
}

export function connectAdminMessageSocket(input: {
  onEvent: (event: AssetMessageWsEvent) => void;
  onClose?: () => void;
  onError?: () => void;
}): AdminMessageSocket | null {
  const token = readAdminToken();
  if (!token) {
    return null;
  }
  const apiBase = resolveAdminApiBase(import.meta.env);
  const socket = new WebSocket(adminMessageWebSocketUrl(apiBase, token));
  socket.onmessage = (event) => {
    if (typeof event.data !== "string") {
      return;
    }
    try {
      input.onEvent(JSON.parse(event.data) as AssetMessageWsEvent);
    } catch {
      // Ignore malformed realtime messages; regular refresh remains available.
    }
  };
  socket.onclose = () => input.onClose?.();
  socket.onerror = () => input.onError?.();
  return {
    close() {
      socket.close();
    }
  };
}
