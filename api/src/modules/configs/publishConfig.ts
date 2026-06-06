import { defaultImagePolicy, type ImagePolicy } from "../images/images.service";
import type { SystemConfigsRepository } from "./configs.repository";

export const USER_ASSET_PUBLISH_ENABLED_KEY = "user_asset_publish_enabled";
export const USER_ASSET_PUBLISH_DISABLED_REASON = "暂未开放用户提交资产";

export type UserAssetPublishConfig = {
  enabled: boolean;
  defaultMinIncrementCents: number;
  defaultDailyPublishLimit: number;
  imagePolicy: ImagePolicy;
};

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePublishEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return !["false", "0", "off", "disabled", "closed"].includes(normalized);
}

export async function readUserAssetPublishConfig(configs: SystemConfigsRepository): Promise<UserAssetPublishConfig> {
  const items = await configs.list();
  const byKey = new Map(items.map((item) => [item.key, item.value]));

  return {
    enabled: parsePublishEnabled(byKey.get(USER_ASSET_PUBLISH_ENABLED_KEY)),
    defaultMinIncrementCents: parsePositiveInteger(byKey.get("default_min_increment_cents"), 100),
    defaultDailyPublishLimit: parseNonNegativeInteger(byKey.get("default_daily_publish_limit"), 3),
    imagePolicy: {
      ...defaultImagePolicy,
      maxImagesPerAsset: parsePositiveInteger(byKey.get("max_images_per_asset"), defaultImagePolicy.maxImagesPerAsset),
      maxImageSizeBytes: parsePositiveInteger(byKey.get("max_image_size_bytes"), defaultImagePolicy.maxImageSizeBytes)
    }
  };
}
