import { wechatSubscribeTemplates } from "@auction/shared";

type ImportMetaEnv = {
  UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID?: string;
  VITE_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID?: string;
  UNI_APP_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID?: string;
  VITE_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID?: string;
  UNI_APP_ASSET_MESSAGE_SUBSCRIBE_TEMPLATE_ID?: string;
  VITE_ASSET_MESSAGE_SUBSCRIBE_TEMPLATE_ID?: string;
};

type SubscribeMessageResponse = Record<string, unknown>;
type SubscribeMessageRuntime = { requestSubscribeMessage?: SubscribeMessageRequester };

declare const __PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__: string | undefined;
declare const __REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID__: string | undefined;
declare const __ASSET_MESSAGE_SUBSCRIBE_TEMPLATE_ID__: string | undefined;

const defaultPriceChangeSubscribeTemplateId = "xnfSOrsId25WJBEWJkbG8UDRp4PD8pyHAx2F_47_2X0";
const defaultReplyMessageSubscribeTemplateId = wechatSubscribeTemplates.replyMessage.templateId;

export type PriceChangeSubscriptionResult = "accepted" | "rejected" | "failed" | "skipped";
export type PriceChangeSubscriptionDebugEvent =
  | { type: "template_missing" }
  | { type: "requester_unavailable"; templateId: string; hasWxRequester: boolean; hasUniRequester: boolean }
  | { type: "request_start"; templateId: string }
  | { type: "request_success"; templateId: string; result: Exclude<PriceChangeSubscriptionResult, "failed" | "skipped">; response: SubscribeMessageResponse }
  | { type: "request_fail"; templateId: string; error: unknown }
  | { type: "request_throw"; templateId: string; error: unknown };

export type SubscribeMessageRequester = (options: {
  tmplIds: string[];
  success: (response: SubscribeMessageResponse) => void;
  fail: (error: unknown) => void;
}) => void;

function firstNonEmptyTemplateId(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

export function readPriceChangeSubscribeTemplateId(env: ImportMetaEnv = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env ?? {}): string {
  const buildTimeTemplateId =
    typeof __PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__ === "undefined" ? "" : __PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__;
  return firstNonEmptyTemplateId(
    env.UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID ??
      env.VITE_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID,
    buildTimeTemplateId,
    defaultPriceChangeSubscribeTemplateId
  );
}

export function readAssetMessageSubscribeTemplateId(env: ImportMetaEnv = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env ?? {}): string {
  const buildTimeReplyTemplateId =
    typeof __REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID__ === "undefined" ? "" : __REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID__;
  const buildTimeAssetMessageTemplateId =
    typeof __ASSET_MESSAGE_SUBSCRIBE_TEMPLATE_ID__ === "undefined" ? "" : __ASSET_MESSAGE_SUBSCRIBE_TEMPLATE_ID__;
  return firstNonEmptyTemplateId(
    env.UNI_APP_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID,
    env.VITE_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID,
    buildTimeReplyTemplateId,
    env.UNI_APP_ASSET_MESSAGE_SUBSCRIBE_TEMPLATE_ID,
    env.VITE_ASSET_MESSAGE_SUBSCRIBE_TEMPLATE_ID,
    buildTimeAssetMessageTemplateId,
    defaultReplyMessageSubscribeTemplateId
  );
}

function defaultSubscribeRequester(): SubscribeMessageRequester | null {
  const runtime = globalThis as typeof globalThis & {
    uni?: SubscribeMessageRuntime;
    wx?: SubscribeMessageRuntime;
  };
  return runtime.wx?.requestSubscribeMessage ?? runtime.uni?.requestSubscribeMessage ?? null;
}

export function requestPriceChangeSubscription(input: {
  templateId?: string;
  requestSubscribeMessage?: SubscribeMessageRequester;
  onDebug?: (event: PriceChangeSubscriptionDebugEvent) => void;
} = {}): Promise<PriceChangeSubscriptionResult> {
  const templateId = (input.templateId ?? readPriceChangeSubscribeTemplateId()).trim();
  if (!templateId) {
    input.onDebug?.({ type: "template_missing" });
    return Promise.resolve("skipped");
  }

  const requestSubscribeMessage = input.requestSubscribeMessage ?? defaultSubscribeRequester();
  if (!requestSubscribeMessage) {
    const runtime = globalThis as typeof globalThis & {
      uni?: SubscribeMessageRuntime;
      wx?: SubscribeMessageRuntime;
    };
    input.onDebug?.({
      type: "requester_unavailable",
      templateId,
      hasWxRequester: typeof runtime.wx?.requestSubscribeMessage === "function",
      hasUniRequester: typeof runtime.uni?.requestSubscribeMessage === "function"
    });
    return Promise.resolve("skipped");
  }

  return new Promise((resolve) => {
    try {
      input.onDebug?.({ type: "request_start", templateId });
      requestSubscribeMessage({
        tmplIds: [templateId],
        success(response) {
          const result = response[templateId] === "accept" ? "accepted" : "rejected";
          input.onDebug?.({ type: "request_success", templateId, result, response });
          resolve(result);
        },
        fail(error) {
          input.onDebug?.({ type: "request_fail", templateId, error });
          resolve("failed");
        }
      });
    } catch (error) {
      input.onDebug?.({ type: "request_throw", templateId, error });
      resolve("failed");
    }
  });
}

export function requestBidRelatedSubscriptions(input: {
  priceChangeTemplateId?: string;
  requestSubscribeMessage?: SubscribeMessageRequester;
  onDebug?: (event: PriceChangeSubscriptionDebugEvent) => void;
} = {}): Promise<PriceChangeSubscriptionResult> {
  const templateIds = [input.priceChangeTemplateId ?? readPriceChangeSubscribeTemplateId()]
    .map((templateId) => templateId.trim())
    .filter((templateId, index, all) => templateId && all.indexOf(templateId) === index);
  if (templateIds.length === 0) {
    input.onDebug?.({ type: "template_missing" });
    return Promise.resolve("skipped");
  }

  const requestSubscribeMessage = input.requestSubscribeMessage ?? defaultSubscribeRequester();
  if (!requestSubscribeMessage) {
    const runtime = globalThis as typeof globalThis & {
      uni?: SubscribeMessageRuntime;
      wx?: SubscribeMessageRuntime;
    };
    input.onDebug?.({
      type: "requester_unavailable",
      templateId: templateIds.join(","),
      hasWxRequester: typeof runtime.wx?.requestSubscribeMessage === "function",
      hasUniRequester: typeof runtime.uni?.requestSubscribeMessage === "function"
    });
    return Promise.resolve("skipped");
  }

  return new Promise((resolve) => {
    try {
      requestSubscribeMessage({
        tmplIds: templateIds,
        success(response) {
          resolve(templateIds.some((templateId) => response[templateId] === "accept") ? "accepted" : "rejected");
        },
        fail() {
          resolve("failed");
        }
      });
    } catch {
      resolve("failed");
    }
  });
}

export function requestAssetMessageSubscription(input: {
  replyMessageTemplateId?: string;
  assetMessageTemplateId?: string;
  requestSubscribeMessage?: SubscribeMessageRequester;
  onDebug?: (event: PriceChangeSubscriptionDebugEvent) => void;
} = {}): Promise<PriceChangeSubscriptionResult> {
  const templateId = (input.replyMessageTemplateId ?? input.assetMessageTemplateId ?? readAssetMessageSubscribeTemplateId()).trim();
  if (!templateId) {
    input.onDebug?.({ type: "template_missing" });
    return Promise.resolve("skipped");
  }

  const requestSubscribeMessage = input.requestSubscribeMessage ?? defaultSubscribeRequester();
  if (!requestSubscribeMessage) {
    const runtime = globalThis as typeof globalThis & {
      uni?: SubscribeMessageRuntime;
      wx?: SubscribeMessageRuntime;
    };
    input.onDebug?.({
      type: "requester_unavailable",
      templateId,
      hasWxRequester: typeof runtime.wx?.requestSubscribeMessage === "function",
      hasUniRequester: typeof runtime.uni?.requestSubscribeMessage === "function"
    });
    return Promise.resolve("skipped");
  }

  return new Promise((resolve) => {
    try {
      requestSubscribeMessage({
        tmplIds: [templateId],
        success(response) {
          resolve(response[templateId] === "accept" ? "accepted" : "rejected");
        },
        fail() {
          resolve("failed");
        }
      });
    } catch {
      resolve("failed");
    }
  });
}
