import type { FastifyInstance } from "fastify";
import { WebSocketServer } from "ws";
import type { AdminRole } from "@auction/shared";
import type { AdminRepository } from "../modules/admin/admin.repository";
import type { PrincipalsRepository } from "../modules/principals/principals.repository";
import type { UsersRepository } from "../modules/users/users.repository";
import type { MessageHub } from "./messageHub";

type UserJwtPayload = { userId: string; kind: "user" };
type AdminJwtPayload = { adminId: string; role: AdminRole; kind: "admin" };
type AuthJwtPayload = UserJwtPayload | AdminJwtPayload;

export function attachMessageWsServer(
  app: FastifyInstance,
  deps: {
    admins: AdminRepository;
    users: UsersRepository;
    principals: PrincipalsRepository;
    hub: MessageHub;
  }
): WebSocketServer {
  const wss = new WebSocketServer({ server: app.server, path: "/ws/messages" });

  wss.on("connection", async (socket, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const token = url.searchParams.get("token")?.trim();
    if (!token) {
      socket.send(JSON.stringify({ type: "error", code: "missing_token", message: "token is required" }));
      socket.close();
      return;
    }

    let unsubscribe: (() => void) | null = null;
    try {
      const payload = app.jwt.verify<AuthJwtPayload>(token);
      if (payload.kind === "user") {
        const user = await deps.users.findById(Number(payload.userId));
        if (!user || user.banned_at !== null) {
          throw new Error("user unavailable");
        }
        unsubscribe = deps.hub.subscribeUser(payload.userId, {
          send(event) {
            if (socket.readyState === socket.OPEN) {
              socket.send(JSON.stringify(event));
            }
          }
        });
      } else {
        const admin = await deps.admins.findById(Number(payload.adminId));
        if (!admin || admin.disabled_at !== null) {
          throw new Error("admin unavailable");
        }
        if (payload.role === "super_admin") {
          unsubscribe = deps.hub.subscribeAllAdmins({
            send(event) {
              if (socket.readyState === socket.OPEN) {
                socket.send(JSON.stringify(event));
              }
            }
          });
        } else {
          const principal = await deps.principals.findActiveByAdminId(Number(payload.adminId));
          if (!principal) {
            throw new Error("principal unavailable");
          }
          unsubscribe = deps.hub.subscribePrincipal(principal.id, {
            send(event) {
              if (socket.readyState === socket.OPEN) {
                socket.send(JSON.stringify(event));
              }
            }
          });
        }
      }
    } catch {
      socket.send(JSON.stringify({ type: "error", code: "invalid_token", message: "Message socket token is invalid" }));
      socket.close();
      return;
    }

    socket.on("close", () => {
      unsubscribe?.();
    });
  });

  return wss;
}
