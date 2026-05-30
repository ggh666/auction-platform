type ImportMetaEnv = {
  UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID?: string;
  VITE_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID?: string;
};

type SubscribeMessageResponse = Record<string, unknown>;
type SubscribeMessageRuntime = { requestSubscribeMessage?: SubscribeMessageRequester };

declare const __PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__: string | undefined;

export type PriceChangeSubscriptionResult = "accepted" | "rejected" | "failed" | "skipped";

export type SubscribeMessageRequester = (options: {
  tmplIds: string[];
  success: (response: SubscribeMessageResponse) => void;
  fail: (error: unknown) => void;
}) => void;

export function readPriceChangeSubscribeTemplateId(env: ImportMetaEnv = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env ?? {}): string {
  const buildTimeTemplateId =
    typeof __PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__ === "undefined" ? "" : __PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__;
  return (
    env.UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID ??
    env.VITE_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID ??
    buildTimeTemplateId ??
    ""
  ).trim();
}

function defaultSubscribeRequester(): SubscribeMessageRequester | null {
  const runtime = globalThis as typeof globalThis & {
    uni?: SubscribeMessageRuntime;
    wx?: SubscribeMessageRuntime;
  };
  return runtime.uni?.requestSubscribeMessage ?? runtime.wx?.requestSubscribeMessage ?? null;
}

export function requestPriceChangeSubscription(input: {
  templateId?: string;
  requestSubscribeMessage?: SubscribeMessageRequester;
} = {}): Promise<PriceChangeSubscriptionResult> {
  const templateId = (input.templateId ?? readPriceChangeSubscribeTemplateId()).trim();
  if (!templateId) {
    return Promise.resolve("skipped");
  }

  const requestSubscribeMessage = input.requestSubscribeMessage ?? defaultSubscribeRequester();
  if (!requestSubscribeMessage) {
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
