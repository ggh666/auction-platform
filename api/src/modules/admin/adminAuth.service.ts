import type { FastifyInstance } from "fastify";
import type { AdminLoginResponse } from "@auction/shared";
import { HttpError, badRequest } from "../../http/errors";
import type { AdminRepository } from "./admin.repository";
import { verifyAdminPassword } from "./adminPassword";

const maxFailedAttempts = 5;
const failureWindowMs = 15 * 60 * 1000;
const lockDurationMs = 15 * 60 * 1000;

type LoginAttemptState = {
  count: number;
  firstFailedAt: number;
  lockedUntil: number | null;
};

function loginAttemptKey(username: string, sourceIp: string): string {
  return `${sourceIp}:${username.trim().toLowerCase()}`;
}

export function createAdminAuthService(app: FastifyInstance, admins: AdminRepository) {
  const attempts = new Map<string, LoginAttemptState>();

  function assertNotRateLimited(key: string, now: number): void {
    const state = attempts.get(key);
    if (!state) {
      return;
    }
    if (state.lockedUntil !== null && state.lockedUntil > now) {
      throw new HttpError(429, "admin_login_rate_limited", "Too many admin login attempts, please try again later");
    }
    if (now - state.firstFailedAt > failureWindowMs) {
      attempts.delete(key);
    }
  }

  function recordFailedAttempt(key: string, now: number): void {
    const existing = attempts.get(key);
    const state =
      existing && now - existing.firstFailedAt <= failureWindowMs
        ? existing
        : { count: 0, firstFailedAt: now, lockedUntil: null };
    state.count += 1;
    if (state.count >= maxFailedAttempts) {
      state.lockedUntil = now + lockDurationMs;
    }
    attempts.set(key, state);
  }

  return {
    async login(username: unknown, password: unknown, sourceIp = "unknown"): Promise<AdminLoginResponse> {
      if (typeof username !== "string" || typeof password !== "string") {
        throw badRequest("invalid_admin_credentials", "Admin username and password are required");
      }

      const key = loginAttemptKey(username, sourceIp);
      const now = Date.now();
      assertNotRateLimited(key, now);

      const normalizedUsername = username.trim();
      const admin = await admins.findByUsername(normalizedUsername);
      if (!admin || admin.disabled_at || !(await verifyAdminPassword(password, admin.password_hash))) {
        recordFailedAttempt(key, now);
        throw new HttpError(401, "invalid_admin_credentials", "Invalid admin credentials");
      }

      attempts.delete(key);
      return {
        token: app.jwt.sign({ adminId: String(admin.id), role: admin.role, kind: "admin" }, { expiresIn: "8h" }),
        admin: { id: String(admin.id), username: admin.username, role: admin.role }
      };
    }
  };
}
