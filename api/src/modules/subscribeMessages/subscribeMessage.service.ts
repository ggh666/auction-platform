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

export type AssetMessageSubscribeMessageInput = {
  touserOpenid: string | null;
  recipientUserId: string;
  conversationId: string;
  assetTitle: string;
  senderDisplayName: string;
  content: string;
  sentAt: string;
};

export type SubscribeMessageService = {
  sendPriceChange(input: PriceChangeSubscribeMessageInput): Promise<void>;
  sendAssetMessage(input: AssetMessageSubscribeMessageInput): Promise<void>;
};

type WechatSubscribeMessageServiceOptions = {
  templateId?: string;
  priceChangeTemplateId?: string;
  replyMessageTemplateId?: string;
  assetMessageTemplateId?: string;
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

function formatWechatDateTime(value: string): string {
  const date = new Date(value);
  const normalizedDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${normalizedDate.getFullYear()}-${pad(normalizedDate.getMonth() + 1)}-${pad(normalizedDate.getDate())} ${pad(normalizedDate.getHours())}:${pad(normalizedDate.getMinutes())}:${pad(normalizedDate.getSeconds())}`;
}

export function createNoopSubscribeMessageService(): SubscribeMessageService {
  return {
    async sendPriceChange() {
      return;
    },
    async sendAssetMessage() {
      return;
    }
  };
}

export function createWechatSubscribeMessageService(options: WechatSubscribeMessageServiceOptions): SubscribeMessageService {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function sendTemplate(input: { touserOpenid: string | null; templateId: string; page: string; data: Record<string, { value: string }> }) {
    const templateId = input.templateId.trim();
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
        page: input.page,
        miniprogram_state: options.miniprogramState,
        lang: "zh_CN",
        data: input.data
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

  return {
    async sendPriceChange(input) {
      await sendTemplate({
        touserOpenid: input.touserOpenid,
        templateId: options.priceChangeTemplateId ?? options.templateId ?? "",
        page: `pages/auctions/detail?assetId=${encodeURIComponent(input.assetId)}`,
        data: {
          amount3: { value: formatTemplateAmount(input.previousAmountCents) },
          amount4: { value: formatTemplateAmount(input.amountCents) },
          thing15: { value: truncateThing(input.assetTitle) },
          time11: { value: formatWechatTime(input.changedAt) }
        }
      });
    },

    async sendAssetMessage(input) {
      await sendTemplate({
        touserOpenid: input.touserOpenid,
        templateId: options.replyMessageTemplateId ?? options.assetMessageTemplateId ?? "",
        page: `pages/profile/asset-chat?conversationId=${encodeURIComponent(input.conversationId)}`,
        data: {
          thing1: { value: truncateThing(input.assetTitle) },
          name2: { value: truncateThing(input.senderDisplayName, 10) },
          thing5: { value: truncateThing(input.content, 20) },
          date4: { value: formatWechatDateTime(input.sentAt) }
        }
      });
    }
  };
}
