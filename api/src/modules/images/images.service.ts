export type ImagePolicy = {
  maxImagesPerAsset: number;
  maxImageSizeBytes: number;
  allowedMimeTypes: string[];
};

export const defaultImagePolicy: ImagePolicy = {
  maxImagesPerAsset: 9,
  maxImageSizeBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
};

export function validateImageUpload(input: { mimeType: unknown; sizeBytes: unknown }, policy = defaultImagePolicy): void {
  if (typeof input.mimeType !== "string" || !policy.allowedMimeTypes.includes(input.mimeType)) {
    throw new Error("Unsupported image type");
  }
  if (typeof input.sizeBytes !== "number" || !Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error("Invalid image size");
  }
  if (input.sizeBytes > policy.maxImageSizeBytes) {
    throw new Error("Image too large");
  }
}

export function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  throw new Error("Unsupported image type");
}

export function uploadDirectoryForAssetType(userId: string, assetType: unknown): string {
  if (assetType === undefined || assetType === null || (typeof assetType === "string" && assetType.trim() === "")) {
    return `uploads/${userId}`;
  }
  if (typeof assetType !== "string") {
    throw new Error("Unsupported image asset type");
  }

  const normalized = assetType.trim();
  if (normalized === "账号") {
    return `uploads/accounts/${userId}`;
  }
  if (normalized === "道具" || normalized === "装备") {
    return `uploads/items/${userId}`;
  }
  throw new Error("Unsupported image asset type");
}
