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
