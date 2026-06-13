import { describe, expect, it, vi } from "vitest";
import { createWechatSubscribeMessageService } from "../../api/src/modules/subscribeMessages/subscribeMessage.service";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    async json() {
      return body;
    }
  } as Response;
}

describe("WeChat subscribe messages", () => {
  it("sends price change notifications using the configured product price template fields", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ errcode: 0 }));
    const service = createWechatSubscribeMessageService({
      templateId: "tmpl-price-change",
      miniprogramState: "formal",
      tokenProvider: { getAccessToken: async () => "access-token" },
      fetchImpl
    });

    await service.sendPriceChange({
      touserOpenid: "openid-1",
      assetId: "asset-9",
      assetTitle: "紫色工程龙珠",
      previousAmountCents: 50000,
      amountCents: 45000,
      actorDisplayName: "买家二",
      changedAt: "2026-05-30T12:34:56"
    } as Parameters<typeof service.sendPriceChange>[0]);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=access-token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          touser: "openid-1",
          template_id: "tmpl-price-change",
          page: "pages/auctions/detail?assetId=asset-9",
          miniprogram_state: "formal",
          lang: "zh_CN",
          data: {
            amount3: { value: "500" },
            amount4: { value: "450" },
            thing15: { value: "紫色工程龙珠" },
            time11: { value: "2026-05-30 12:34" }
          }
        })
      })
    );
  });

  it("does not expose deal contact reminder sending", () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ errcode: 0 }));
    const service = createWechatSubscribeMessageService({
      priceChangeTemplateId: "tmpl-price-change",
      miniprogramState: "trial",
      tokenProvider: { getAccessToken: async () => "access-token" },
      fetchImpl
    });

    expect("sendDealContactRequired" in service).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends asset conversation notifications to the chat page using the asset message template", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ errcode: 0 }));
    const service = createWechatSubscribeMessageService({
      priceChangeTemplateId: "tmpl-price-change",
      assetMessageTemplateId: "tmpl-asset-message",
      miniprogramState: "trial",
      tokenProvider: { getAccessToken: async () => "access-token" },
      fetchImpl
    });

    await service.sendAssetMessage({
      touserOpenid: "openid-2",
      recipientUserId: "2",
      conversationId: "conversation-9",
      assetTitle: "紫色工程龙珠",
      senderDisplayName: "发布者",
      content: "可以，先说下你的资源",
      sentAt: "2026-06-06T12:34:56"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=access-token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          touser: "openid-2",
          template_id: "tmpl-asset-message",
          page: "pages/profile/asset-chat?conversationId=conversation-9",
          miniprogram_state: "trial",
          lang: "zh_CN",
          data: {
            thing1: { value: "紫色工程龙珠" },
            name2: { value: "发布者" },
            thing3: { value: "可以，先说下你的资源" },
            time4: { value: "2026-06-06 12:34" }
          }
        })
      })
    );
  });
});
