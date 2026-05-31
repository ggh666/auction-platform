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
});
