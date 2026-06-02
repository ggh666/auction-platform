import { badRequest } from "../../http/errors";

export type ImageSafetyStatus = "pending" | "pass" | "review" | "risky" | "failed";

export type TextSafetyInput = {
  content: string;
  openid?: string | null;
  scene?: number;
};

export type ImageSafetyInput = {
  userId?: string;
  objectKey: string;
  mediaUrl: string;
  openid?: string | null;
  scene?: number;
};

export type ImageUploadSafetyInput = {
  userId: string;
  images?: Array<{
    objectKey: unknown;
    publicUrl: unknown;
  }>;
};

export type ImageSafetyRequestResult = {
  status: ImageSafetyStatus;
  traceId?: string;
};

export type ContentSafetyService = {
  assertTextAllowed(input: TextSafetyInput): Promise<void>;
  requestImageCheck(input: ImageSafetyInput): Promise<ImageSafetyRequestResult>;
  assertImageUploadsAllowed(input: ImageUploadSafetyInput): Promise<void>;
  assertAssetImagesAllowed(assetId: string): Promise<void>;
  handleImageCheckCallback?(input: unknown): Promise<void>;
};

const prohibitedMarketplaceTerms = ["赌博", "博彩", "卖淫", "嫖娼", "招嫖", "援交", "偷盗", "盗号", "洗钱", "诈骗"];

export function assertLocalMarketplaceTextAllowed(content: string): void {
  const normalizedContent = content.replace(/\s+/g, "");
  const matchedTerm = prohibitedMarketplaceTerms.find((term) => normalizedContent.includes(term));
  if (!matchedTerm) {
    return;
  }

  throw badRequest("content_safety_risky", "Content safety check failed", {
    source: "local_text_policy",
    keyword: matchedTerm
  });
}

export function createNoopContentSafetyService(): ContentSafetyService {
  return {
    async assertTextAllowed() {},
    async requestImageCheck() {
      return { status: "pass" };
    },
    async assertImageUploadsAllowed() {},
    async assertAssetImagesAllowed() {}
  };
}
