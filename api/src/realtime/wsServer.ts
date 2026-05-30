import type http from "node:http";
import { WebSocketServer } from "ws";
import type { AuctionHub } from "./auctionHub";

export function attachAuctionWsServer(server: http.Server, hub: AuctionHub): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws/auctions" });

  wss.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const assetId = url.searchParams.get("assetId")?.trim();

    if (!assetId) {
      socket.send(JSON.stringify({ type: "error", code: "missing_asset_id", message: "assetId is required" }));
      socket.close();
      return;
    }

    const unsubscribe = hub.subscribe(assetId, {
      send(event) {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(event));
        }
      }
    });

    socket.on("close", unsubscribe);
  });

  return wss;
}
