import type { FastifyInstance } from "fastify";
import type { LoginResponse, UserSummary, WechatLoginRequest } from "@auction/shared";
import type { Env } from "../../config/env";
import { HttpError, badRequest } from "../../http/errors";
import type { UsersRepository } from "../users/users.repository";

export type WechatCodeSession = {
  openid: string;
  sessionKey?: string;
  unionid?: string;
};

export type WechatCodeSessionExchanger = (code: string) => Promise<WechatCodeSession>;

export type AuthService = {
  mockLogin(displayName: unknown): Promise<LoginResponse>;
  wechatLogin(input: unknown): Promise<LoginResponse>;
};

export type AuthServiceOptions = {
  env: Pick<Env, "nodeEnv" | "wechatAppId" | "wechatAppSecret">;
  wechatCodeSessionExchanger?: WechatCodeSessionExchanger;
};

type WechatCode2SessionResponse = {
  openid?: unknown;
  session_key?: unknown;
  unionid?: unknown;
  errcode?: unknown;
  errmsg?: unknown;
};

const userTokenExpiresIn = "30d";

function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    return "微信用户";
  }

  const normalized = value.trim().slice(0, 64);
  return normalized || "微信用户";
}

function normalizeAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function assertWechatLoginRequest(input: unknown): WechatLoginRequest {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw badRequest("invalid_wechat_login", "WeChat login payload is invalid");
  }

  const code = (input as { code?: unknown }).code;
  if (typeof code !== "string" || !code.trim()) {
    throw badRequest("invalid_wechat_code", "WeChat login code is required");
  }

  return {
    code: code.trim(),
    displayName: normalizeDisplayName((input as { displayName?: unknown }).displayName),
    avatarUrl: normalizeAvatarUrl((input as { avatarUrl?: unknown }).avatarUrl)
  };
}

function toUserSummary(user: Awaited<ReturnType<UsersRepository["findOrCreateMockUser"]>>): UserSummary {
  return {
    id: String(user.id),
    displayName: user.display_name,
    avatarUrl: user.avatar_url ?? undefined,
    banned: user.banned_at !== null,
    violationCount: user.violation_count,
    creditScore: user.credit_score,
    creditResetAt: user.credit_reset_at === null ? null : new Date(user.credit_reset_at).toISOString()
  };
}

function createDefaultWechatCodeSessionExchanger(
  env: Pick<Env, "nodeEnv" | "wechatAppId" | "wechatAppSecret">
): WechatCodeSessionExchanger {
  return async (code) => {
    if (!env.wechatAppId || !env.wechatAppSecret) {
      if (env.nodeEnv !== "production") {
        return { openid: `dev:${code}` };
      }

      throw new HttpError(500, "wechat_credentials_missing", "WeChat credentials are not configured");
    }

    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
    url.searchParams.set("appid", env.wechatAppId);
    url.searchParams.set("secret", env.wechatAppSecret);
    url.searchParams.set("js_code", code);
    url.searchParams.set("grant_type", "authorization_code");

    const response = await fetch(url);
    if (!response.ok) {
      throw new HttpError(502, "wechat_session_exchange_failed", "WeChat session exchange failed");
    }

    const data = (await response.json()) as WechatCode2SessionResponse;
    if (typeof data.errcode === "number" && data.errcode !== 0) {
      const message = typeof data.errmsg === "string" && data.errmsg ? data.errmsg : "WeChat login code is invalid";
      throw badRequest("wechat_login_failed", message);
    }
    if (typeof data.openid !== "string" || !data.openid.trim()) {
      throw new HttpError(502, "wechat_openid_missing", "WeChat session response did not include openid");
    }

    return {
      openid: data.openid,
      sessionKey: typeof data.session_key === "string" ? data.session_key : undefined,
      unionid: typeof data.unionid === "string" ? data.unionid : undefined
    };
  };
}

export function createAuthService(app: FastifyInstance, users: UsersRepository, options: AuthServiceOptions): AuthService {
  const exchangeWechatCode =
    options.wechatCodeSessionExchanger ?? createDefaultWechatCodeSessionExchanger(options.env);

  return {
    async mockLogin(displayName) {
      if (typeof displayName !== "string") {
        throw badRequest("invalid_display_name", "Display name is required");
      }

      const normalized = displayName.trim().slice(0, 64);
      if (!normalized) {
        throw badRequest("invalid_display_name", "Display name is required");
      }

      const user = await users.findOrCreateMockUser(normalized);
      const token = app.jwt.sign({ userId: String(user.id), kind: "user" }, { expiresIn: userTokenExpiresIn });
      return {
        token,
        user: toUserSummary(user)
      };
    },

    async wechatLogin(input) {
      const body = assertWechatLoginRequest(input);
      const session = await exchangeWechatCode(body.code);
      const user = await users.findOrCreateWechatUser({
        openid: session.openid,
        displayName: body.displayName ?? "微信用户",
        avatarUrl: body.avatarUrl
      });
      const token = app.jwt.sign({ userId: String(user.id), kind: "user" }, { expiresIn: userTokenExpiresIn });
      return {
        token,
        user: toUserSummary(user)
      };
    }
  };
}
