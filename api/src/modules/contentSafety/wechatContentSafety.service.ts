import { HttpError, badRequest } from "../../http/errors";
import type { AssetsRepository } from "../assets/assets.repository";
import type { UsersRepository } from "../users/users.repository";
import { assertLocalMarketplaceTextAllowed } from "./contentSafety.service";
import type {
  ContentSafetyService,
  ImageSafetyInput,
  ImageSafetyStatus,
  ImageUploadSafetyInput,
  TextSafetyInput
} from "./contentSafety.service";
import type { ImageSafetyRepository } from "./imageSafety.repository";
import type { WechatAccessTokenProvider } from "./wechatAccessToken.service";

type FetchLike = typeof fetch;
type WechatSuggest = "pass" | "review" | "risky";
type ImageDownloadRetryScheduler = (task: () => Promise<void>, delayMs: number) => void | Promise<void>;
type ImageDownloadRetry = { attempt: number; previousTraceId: string; reason: string };
type ImageCheckUrlBuilder = (input: { objectKey: string; publicUrl: string }) => string;
type ImageMediaCheckDetail = { submittedUrlType: "backend_proxy" | "public_url"; submittedHost: string | null; submittedPath: string | null };

type WechatCheckResponse = {
  errcode?: unknown;
  errmsg?: unknown;
  trace_id?: unknown;
  result?: {
    suggest?: unknown;
    label?: unknown;
  };
  detail?: unknown;
};

type WechatContentSafetyOptions = {
  enabled: boolean;
  strict: boolean;
  tokenProvider: WechatAccessTokenProvider;
  imageSafetyRepository: ImageSafetyRepository;
  assetsRepository: AssetsRepository;
  usersRepository?: Pick<UsersRepository, "findById">;
  imageDownloadRetryDelayMs?: number;
  imageDownloadRetryMaxAttempts?: number;
  imageDownloadRetryScheduler?: ImageDownloadRetryScheduler;
  imageCheckUrlBuilder?: ImageCheckUrlBuilder;
  fetchImpl?: FetchLike;
};

const wechatMediaDownloadErrorCode = -1008;
const defaultImageDownloadRetryDelayMs = 0;
const defaultImageDownloadRetryMaxAttempts = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSuggest(value: unknown): WechatSuggest | null {
  return value === "pass" || value === "review" || value === "risky" ? value : null;
}

function statusFromSuggest(suggest: WechatSuggest | null): ImageSafetyStatus {
  if (suggest === "pass" || suggest === "review" || suggest === "risky") {
    return suggest;
  }
  return "failed";
}

function labelFrom(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function numberFrom(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function assertOpenid(openid: string | null | undefined): string {
  if (!openid?.trim()) {
    throw badRequest("content_safety_openid_missing", "WeChat openid is required for content safety check");
  }
  return openid.trim();
}

function normalizeImageUploadCandidates(images: ImageUploadSafetyInput["images"]): Array<{ objectKey: string; publicUrl: string }> {
  if (!images || images.length === 0) {
    return [];
  }

  return images.map((image) => {
    const objectKey = typeof image.objectKey === "string" ? image.objectKey.trim() : "";
    const publicUrl = typeof image.publicUrl === "string" ? image.publicUrl.trim() : "";
    if (!objectKey || !publicUrl) {
      throw badRequest("invalid_asset_images", "Asset images are invalid");
    }
    return { objectKey, publicUrl };
  });
}

function assertWechatAllowed(response: WechatCheckResponse): void {
  const suggest = normalizeSuggest(response.result?.suggest);
  if (suggest === "pass") {
    return;
  }
  if (suggest === "review") {
    throw badRequest("content_safety_review", "Content requires manual review", {
      label: response.result ? labelFrom(response.result.label) : null,
      traceId: typeof response.trace_id === "string" ? response.trace_id : undefined
    });
  }
  throw badRequest("content_safety_risky", "Content safety check failed", {
    label: response.result ? labelFrom(response.result.label) : null,
    traceId: typeof response.trace_id === "string" ? response.trace_id : undefined
  });
}

async function readWechatResponse(response: Response, strict: boolean): Promise<WechatCheckResponse> {
  if (!response.ok) {
    if (strict) {
      throw new HttpError(502, "wechat_content_safety_failed", "WeChat content safety request failed");
    }
    return {};
  }

  const body = (await response.json()) as WechatCheckResponse;
  if (typeof body.errcode === "number" && body.errcode !== 0) {
    if (strict) {
      const message = typeof body.errmsg === "string" && body.errmsg ? body.errmsg : "WeChat content safety request failed";
      throw new HttpError(502, "wechat_content_safety_failed", message);
    }
    return {};
  }
  return body;
}

function callbackTraceId(input: unknown): string | null {
  if (!isRecord(input)) {
    return null;
  }
  const traceId = input.trace_id ?? input.traceId;
  return typeof traceId === "string" && traceId.trim() ? traceId.trim() : null;
}

function isRetryableImageDownloadCallback(input: unknown): boolean {
  return isRecord(input) && numberFrom(input.errcode) === wechatMediaDownloadErrorCode;
}

function retryAttemptFromDetailJson(detailJson: unknown): number {
  if (!isRecord(detailJson) || !isRecord(detailJson.retry)) {
    return 0;
  }
  const attempt = detailJson.retry.attempt;
  return typeof attempt === "number" && Number.isInteger(attempt) && attempt > 0 ? attempt : 0;
}

function callbackOpenidFromDetailJson(detailJson: unknown): string | null {
  if (!isRecord(detailJson)) {
    return null;
  }
  const openid = detailJson.FromUserName ?? detailJson.fromUserName ?? detailJson.from_user_name;
  return typeof openid === "string" && openid.trim() ? openid.trim() : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

function detailJsonWithRetryFailure(
  detailJson: unknown,
  retry: ImageDownloadRetry,
  failure: { reason: string; message: string }
): unknown {
  const base = isRecord(detailJson) ? detailJson : { callback: detailJson };
  return {
    ...base,
    retryFailure: {
      attempt: retry.attempt,
      previousTraceId: retry.previousTraceId,
      reason: failure.reason,
      message: failure.message
    }
  };
}

function callbackResult(input: unknown): { status: ImageSafetyStatus; label: number | null; detailJson: unknown | null } {
  if (!isRecord(input)) {
    return { status: "failed", label: null, detailJson: null };
  }
  const result = isRecord(input.result) ? input.result : {};
  const suggest = normalizeSuggest(result.suggest);
  return {
    status: statusFromSuggest(suggest),
    label: labelFrom(result.label),
    detailJson: input
  };
}

function safeUrlDetail(value: string): { host: string | null; path: string | null } {
  try {
    const url = new URL(value);
    return {
      host: url.host,
      path: url.pathname.startsWith("/api/wechat/media-check-image/") ? "/api/wechat/media-check-image/*" : url.pathname
    };
  } catch {
    return { host: null, path: null };
  }
}

function mediaCheckDetail(publicUrl: string, submittedUrl: string): ImageMediaCheckDetail {
  const detail = safeUrlDetail(submittedUrl);
  return {
    submittedUrlType: submittedUrl === publicUrl ? "public_url" : "backend_proxy",
    submittedHost: detail.host,
    submittedPath: detail.path
  };
}

function imageRequestDetailJson(body: WechatCheckResponse, input: ImageSafetyInput, checkMediaUrl: string, retry?: ImageDownloadRetry): unknown {
  return {
    ...body,
    mediaCheck: mediaCheckDetail(input.mediaUrl, checkMediaUrl),
    ...(retry ? { retry } : {})
  };
}

function imageCallbackDetailJson(existingDetailJson: unknown, callbackDetailJson: unknown): unknown {
  const existing = isRecord(existingDetailJson) ? existingDetailJson : {};
  const callback = isRecord(callbackDetailJson) ? callbackDetailJson : { callback: callbackDetailJson };
  return {
    ...existing,
    ...callback,
    mediaCheck: callback.mediaCheck ?? existing.mediaCheck,
    retry: callback.retry ?? existing.retry
  };
}

export function createWechatContentSafetyService(options: WechatContentSafetyOptions): ContentSafetyService {
  const fetchImpl = options.fetchImpl ?? fetch;
  const imageDownloadRetryDelayMs = options.imageDownloadRetryDelayMs ?? defaultImageDownloadRetryDelayMs;
  const imageDownloadRetryMaxAttempts = options.imageDownloadRetryMaxAttempts ?? defaultImageDownloadRetryMaxAttempts;
  const configuredImageDownloadRetryScheduler = options.imageDownloadRetryScheduler;

  async function scheduleImageDownloadRetry(task: () => Promise<void>, delayMs: number): Promise<void> {
    if (configuredImageDownloadRetryScheduler) {
      await configuredImageDownloadRetryScheduler(task, delayMs);
      return;
    }
    if (delayMs <= 0) {
      await task();
      return;
    }
    const timer = setTimeout(() => {
      void task().catch(() => undefined);
    }, delayMs);
    if (typeof timer === "object" && "unref" in timer && typeof timer.unref === "function") {
      timer.unref();
    }
  }

  function mediaUrlForWechat(input: ImageSafetyInput): string {
    return options.imageCheckUrlBuilder?.({ objectKey: input.objectKey, publicUrl: input.mediaUrl }) ?? input.mediaUrl;
  }

  async function submitImageCheck(input: ImageSafetyInput, retry?: ImageDownloadRetry) {
    const accessToken = await options.tokenProvider.getAccessToken();
    const openid = assertOpenid(input.openid);
    const checkMediaUrl = mediaUrlForWechat(input);
    const response = await fetchImpl(`https://api.weixin.qq.com/wxa/media_check_async?access_token=${accessToken}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        media_url: checkMediaUrl,
        media_type: 2,
        version: 2,
        scene: input.scene ?? 3,
        openid
      })
    });
    const body = await readWechatResponse(response, options.strict);
    const traceId = typeof body.trace_id === "string" && body.trace_id.trim() ? body.trace_id.trim() : undefined;
    await options.imageSafetyRepository.record({
      userId: input.userId ?? "0",
      objectKey: input.objectKey,
      publicUrl: input.mediaUrl,
      status: traceId ? "pending" : "failed",
      traceId,
      detailJson: imageRequestDetailJson(body, input, checkMediaUrl, retry)
    });
    return { status: traceId ? "pending" : "failed", traceId } satisfies { status: ImageSafetyStatus; traceId?: string };
  }

  async function scheduleRetryableImageDownloadFailure(traceId: string, recordDetailJson: unknown, callbackDetailJson: unknown) {
    if (!options.usersRepository || imageDownloadRetryMaxAttempts <= 0) {
      return;
    }
    const record = await options.imageSafetyRepository.findByTraceId(traceId);
    if (!record) {
      return;
    }
    const nextAttempt = retryAttemptFromDetailJson(recordDetailJson) + 1;
    if (nextAttempt > imageDownloadRetryMaxAttempts) {
      return;
    }
    const retry: ImageDownloadRetry = {
      attempt: nextAttempt,
      previousTraceId: traceId,
      reason: "wechat_media_download_error"
    };

    await scheduleImageDownloadRetry(async () => {
      const user = await options.usersRepository?.findById(Number(record.userId));
      const openid = user?.openid?.trim() || callbackOpenidFromDetailJson(callbackDetailJson);
      if (!openid) {
        await options.imageSafetyRepository.updateByTraceId({
          traceId,
          status: "failed",
          label: null,
          detailJson: detailJsonWithRetryFailure(callbackDetailJson, retry, {
            reason: "wechat_media_download_retry_openid_missing",
            message: "WeChat openid is missing for retry"
          })
        });
        return;
      }
      try {
        await submitImageCheck(
          {
            userId: record.userId,
            objectKey: record.objectKey,
            mediaUrl: record.publicUrl,
            openid,
            scene: 3
          },
          retry
        );
      } catch (error) {
        await options.imageSafetyRepository.updateByTraceId({
          traceId,
          status: "failed",
          label: null,
          detailJson: detailJsonWithRetryFailure(callbackDetailJson, retry, {
            reason: "wechat_media_download_retry_failed",
            message: errorMessage(error)
          })
        });
      }
    }, imageDownloadRetryDelayMs);
  }

  return {
    async assertTextAllowed(input: TextSafetyInput) {
      if (!options.enabled || !input.content.trim()) {
        return;
      }
      assertLocalMarketplaceTextAllowed(input.content);
      const accessToken = await options.tokenProvider.getAccessToken();
      const openid = assertOpenid(input.openid);
      const response = await fetchImpl(`https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: input.content,
          version: 2,
          scene: input.scene ?? 3,
          openid
        })
      });
      assertWechatAllowed(await readWechatResponse(response, options.strict));
    },

    async requestImageCheck(input: ImageSafetyInput) {
      if (!options.enabled) {
        await options.imageSafetyRepository.record({
          userId: input.userId ?? "0",
          objectKey: input.objectKey,
          publicUrl: input.mediaUrl,
          status: "pass"
        });
        return { status: "pass" };
      }

      return submitImageCheck(input);
    },

    async assertImageUploadsAllowed(input: ImageUploadSafetyInput) {
      if (!options.enabled) {
        return;
      }
      const images = normalizeImageUploadCandidates(input.images);
      if (images.length === 0) {
        return;
      }

      const records = await options.imageSafetyRepository.findByPublicUrls(images.map((image) => image.publicUrl));
      const recordsByUrl = new Map(records.map((record) => [record.publicUrl, record]));
      for (const image of images) {
        const record = recordsByUrl.get(image.publicUrl);
        if (!record || record.userId !== input.userId || record.objectKey !== image.objectKey) {
          throw badRequest("invalid_asset_images", "Asset images must be uploaded by current user");
        }
      }
    },

    async readImageUploadSafetyStatuses(input: ImageUploadSafetyInput) {
      if (!options.enabled) {
        return normalizeImageUploadCandidates(input.images).map(() => "pass" as const);
      }
      const images = normalizeImageUploadCandidates(input.images);
      if (images.length === 0) {
        return [];
      }

      const records = await options.imageSafetyRepository.findByPublicUrls(images.map((image) => image.publicUrl));
      const recordsByUrl = new Map(records.map((record) => [record.publicUrl, record]));
      return images.map((image) => {
        const record = recordsByUrl.get(image.publicUrl);
        if (!record || record.userId !== input.userId || record.objectKey !== image.objectKey) {
          throw badRequest("invalid_asset_images", "Asset images must be uploaded by current user");
        }
        return record.status;
      });
    },

    async assertAssetImagesAllowed(assetId: string) {
      if (!options.enabled) {
        return;
      }
      const asset = await options.assetsRepository.findById(assetId);
      if (!asset || asset.imageUrls.length === 0) {
        return;
      }
      const records = await options.imageSafetyRepository.findByPublicUrls(asset.imageUrls);
      const recordsByUrl = new Map(records.map((record) => [record.publicUrl, record]));

      for (const publicUrl of asset.imageUrls) {
        const record = recordsByUrl.get(publicUrl);
        if (!record) {
          throw badRequest("image_safety_missing", "图片未经过上传安全检测，请重新上传后再审核");
        }
        if (record.status === "risky") {
          throw badRequest("image_safety_risky", "图片命中微信内容安全高风险，请更换图片后再审核通过");
        }
        if (record.status !== "pass" && record.status !== "review") {
          throw badRequest("image_safety_pending", "图片安全检测尚未完成，请稍后刷新后再审核");
        }
      }
    },

    async handleImageCheckCallback(input: unknown) {
      const traceId = callbackTraceId(input);
      if (!traceId) {
        return;
      }
      const retryableDownloadFailure = isRetryableImageDownloadCallback(input);
      const existingRecord = await options.imageSafetyRepository.findByTraceId(traceId);
      const result = callbackResult(input);
      const mergedDetailJson = existingRecord ? imageCallbackDetailJson(existingRecord.detailJson, result.detailJson) : result.detailJson;
      await options.imageSafetyRepository.updateByTraceId({
        traceId,
        status: result.status,
        label: result.label,
        detailJson: mergedDetailJson
      });
      if (retryableDownloadFailure && existingRecord) {
        await scheduleRetryableImageDownloadFailure(traceId, existingRecord.detailJson, mergedDetailJson);
      }
    }
  };
}
