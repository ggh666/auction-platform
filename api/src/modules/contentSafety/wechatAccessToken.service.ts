import { HttpError } from "../../http/errors";

type FetchLike = typeof fetch;

type WechatAccessTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  errcode?: unknown;
  errmsg?: unknown;
};

export type WechatAccessTokenProvider = {
  getAccessToken(): Promise<string>;
};

type WechatAccessTokenProviderOptions = {
  env: {
    wechatAppId: string;
    wechatAppSecret: string;
  };
  fetchImpl?: FetchLike;
  now?: () => number;
};

export function createWechatAccessTokenProvider(options: WechatAccessTokenProviderOptions): WechatAccessTokenProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  let cachedToken: string | null = null;
  let expiresAtMs = 0;

  return {
    async getAccessToken() {
      if (cachedToken && now() < expiresAtMs - 5 * 60 * 1000) {
        return cachedToken;
      }

      const response = await fetchImpl("https://api.weixin.qq.com/cgi-bin/stable_token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credential",
          appid: options.env.wechatAppId,
          secret: options.env.wechatAppSecret,
          force_refresh: false
        })
      });

      if (!response.ok) {
        throw new HttpError(502, "wechat_access_token_failed", "WeChat access token request failed");
      }

      const body = (await response.json()) as WechatAccessTokenResponse;
      if (typeof body.errcode === "number" && body.errcode !== 0) {
        const message = typeof body.errmsg === "string" && body.errmsg ? body.errmsg : "WeChat access token request failed";
        throw new HttpError(502, "wechat_access_token_failed", message);
      }
      if (typeof body.access_token !== "string" || !body.access_token.trim()) {
        throw new HttpError(502, "wechat_access_token_missing", "WeChat access token response is invalid");
      }

      const expiresInSeconds = typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : 7200;
      cachedToken = body.access_token;
      expiresAtMs = now() + expiresInSeconds * 1000;
      return cachedToken;
    }
  };
}
