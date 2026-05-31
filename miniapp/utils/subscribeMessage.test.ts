import { describe, expect, it } from "vitest";
import { requestPriceChangeSubscription, readPriceChangeSubscribeTemplateId } from "./subscribeMessage";

type SubscribeRuntime = {
  requestSubscribeMessage(options: {
    tmplIds: string[];
    success: (response: Record<string, unknown>) => void;
    fail: (error: unknown) => void;
  }): void;
};

describe("miniapp subscribe message helpers", () => {
  it("reads the configured price change template id", () => {
    expect(readPriceChangeSubscribeTemplateId({ UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID: " tmpl-1 " })).toBe("tmpl-1");
    expect(readPriceChangeSubscribeTemplateId({})).toBe("");
  });

  it("skips subscription requests when no template id is configured", async () => {
    const result = await requestPriceChangeSubscription({
      templateId: "",
      requestSubscribeMessage() {
        throw new Error("should not be called");
      }
    });

    expect(result).toBe("skipped");
  });

  it("requests the configured template and reports acceptance", async () => {
    const requestedTemplateIds: string[][] = [];
    const result = await requestPriceChangeSubscription({
      templateId: "tmpl-1",
      requestSubscribeMessage(options) {
        requestedTemplateIds.push(options.tmplIds);
        options.success({ "tmpl-1": "accept" });
      }
    });

    expect(requestedTemplateIds).toEqual([["tmpl-1"]]);
    expect(result).toBe("accepted");
  });

  it("uses wx.requestSubscribeMessage first in WeChat mini program runtime", async () => {
    const runtime = globalThis as typeof globalThis & {
      uni?: SubscribeRuntime;
      wx?: SubscribeRuntime;
    };
    const originalUni = runtime.uni;
    const originalWx = runtime.wx;
    const calls: string[] = [];
    runtime.uni = {
      requestSubscribeMessage(options) {
        calls.push("uni");
        options.success({ "tmpl-1": "accept" });
      }
    };
    runtime.wx = {
      requestSubscribeMessage(options) {
        calls.push("wx");
        options.success({ "tmpl-1": "accept" });
      }
    };

    try {
      const result = await requestPriceChangeSubscription({ templateId: "tmpl-1" });

      expect(result).toBe("accepted");
      expect(calls).toEqual(["wx"]);
    } finally {
      runtime.uni = originalUni;
      runtime.wx = originalWx;
    }
  });

  it("reports failure instead of throwing when the platform requester fails synchronously", async () => {
    await expect(
      requestPriceChangeSubscription({
        templateId: "tmpl-1",
        requestSubscribeMessage() {
          throw new Error("requestSubscribeMessage unavailable");
        }
      })
    ).resolves.toBe("failed");
  });
});
