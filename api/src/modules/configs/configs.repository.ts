import type { SystemConfig } from "@auction/shared";

export type SystemConfigsRepository = {
  list(): Promise<SystemConfig[]>;
  update(key: string, value: string, updatedBy: number): Promise<SystemConfig>;
};

const defaultConfigs: SystemConfig[] = [
  { key: "default_min_increment_cents", value: "100", updatedBy: null, updatedAt: new Date(0).toISOString() },
  { key: "extension_window_seconds", value: "300", updatedBy: null, updatedAt: new Date(0).toISOString() },
  { key: "extension_duration_seconds", value: "300", updatedBy: null, updatedAt: new Date(0).toISOString() },
  { key: "max_images_per_asset", value: "9", updatedBy: null, updatedAt: new Date(0).toISOString() },
  { key: "max_image_size_bytes", value: "5242880", updatedBy: null, updatedAt: new Date(0).toISOString() },
  { key: "default_daily_publish_limit", value: "3", updatedBy: null, updatedAt: new Date(0).toISOString() },
  { key: "user_asset_publish_enabled", value: "true", updatedBy: null, updatedAt: new Date(0).toISOString() }
];

function cloneConfig(config: SystemConfig): SystemConfig {
  return { ...config };
}

export function createInMemorySystemConfigsRepository(): SystemConfigsRepository {
  const configs = new Map(defaultConfigs.map((config) => [config.key, cloneConfig(config)]));

  return {
    async list() {
      return defaultConfigs.map((config) => cloneConfig(configs.get(config.key) ?? config));
    },

    async update(key, value, updatedBy) {
      const current = configs.get(key);
      if (!current) {
        throw new Error("Config not found");
      }

      const updated: SystemConfig = {
        key,
        value,
        updatedBy,
        updatedAt: new Date().toISOString()
      };
      configs.set(key, updated);
      return cloneConfig(updated);
    }
  };
}
