import { centsToYuanText } from "@auction/shared";
import { HttpError } from "../../http/errors";
import type { WechatAccessTokenProvider } from "../contentSafety/wechatAccessToken.service";

type FetchLike = typeof fetch;

type WechatSubscribeSendResponse = {
  errcode?: unknown;
  errmsg?: unknown;
};

export type PriceChangeSubscribeMessageInput = {
  touserOpenid: string | null;
  assetId: string;
  assetTitle: string;
  previousAmountCents: number;
  amountCents: number;
  actorDisplayName: string;
  changedAt: string;
};

export type SubscribeMessageService = {
  sendPriceChange(input: PriceChangeSubscribeMessageInput): Promise<void>;
};

type WechatSubscribeMessageServiceOptions = {
  templateId: string;
  miniprogramState: "developer" | "trial" | "formal";
  tokenProvider: WechatAccessTokenProvider;
  fetchImpl?: FetchLike;
};

function truncateThing(value: string, maxLength = 20): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized || "交换信息";
}

function formatTemplateAmount(cents: number): string {
  return centsToYuanText(cents);
}

function formatWechatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 16).replace("T", " ");
  }
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createNoopSubscribeMessageService(): SubscribeMessageService {
  return {
    async sendPriceChange() {
      return;
    }
  };
}

export function createWechatSubscribeMessageService(options: WechatSubscribeMessageServiceOptions): SubscribeMessageService {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async sendPriceChange(input) {
      const templateId = options.templateId.trim();
      const touser = input.touserOpenid?.trim();
      if (!templateId || !touser) {
        return;
      }

      const accessToken = await options.tokenProvider.getAccessToken();
      const response = await fetchImpl(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          touser,
          template_id: templateId,
          page: `pages/auctions/detail?assetId=${encodeURIComponent(input.assetId)}`,
          miniprogram_state: options.miniprogramState,
          lang: "zh_CN",
          data: {
            amount3: { value: formatTemplateAmount(input.previousAmountCents) },
            amount4: { value: formatTemplateAmount(input.amountCents) },
            thing15: { value: truncateThing(input.assetTitle) },
            time11: { value: formatWechatTime(input.changedAt) }
          }
        })
      });

      if (!response.ok) {
        throw new HttpError(502, "wechat_subscribe_message_failed", "WeChat subscribe message request failed");
      }

      const body = (await response.json()) as WechatSubscribeSendResponse;
      if (typeof body.errcode === "number" && body.errcode !== 0) {
        if (body.errcode === 43101) {
          return;
        }
        const message = typeof body.errmsg === "string" && body.errmsg ? body.errmsg : "WeChat subscribe message request failed";
        throw new HttpError(502, "wechat_subscribe_message_failed", message);
      }
    }
  };
}
