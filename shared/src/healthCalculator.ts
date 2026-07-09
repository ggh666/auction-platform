export const healthCalculatorEquipmentOptions = ["无", "龙心", "烟斗", "强袭", "圣剑"] as const;
export const healthCalculatorPhantomSkinOptions = ["无", "紫金铃铛"] as const;
export const healthCalculatorFullStarDeathOptions = ["无", "8", "20"] as const;
export const healthCalculatorGreenStarDeathOptions = ["无", "4", "16"] as const;
export const healthCalculatorDeathSkinOptions = ["无", "万圣节死神", "粉色南瓜死神"] as const;

export type HealthCalculatorEquipment = (typeof healthCalculatorEquipmentOptions)[number];
export type HealthCalculatorPhantomSkin = (typeof healthCalculatorPhantomSkinOptions)[number];
export type HealthCalculatorFullStarDeathLevel = (typeof healthCalculatorFullStarDeathOptions)[number];
export type HealthCalculatorGreenStarDeathLevel = (typeof healthCalculatorGreenStarDeathOptions)[number];
export type HealthCalculatorDeathSkin = (typeof healthCalculatorDeathSkinOptions)[number];

export type HealthCalculatorConfig = {
  mainCardHealth: number | string;
  subCardHealth: number | string;
  equipment: HealthCalculatorEquipment;
  phantomSkin: HealthCalculatorPhantomSkin;
  fullStarDeathLevel: HealthCalculatorFullStarDeathLevel;
  greenStarDeathLevel: HealthCalculatorGreenStarDeathLevel;
  deathSkin: HealthCalculatorDeathSkin;
  deathDemonized: boolean;
  priestCount: number | string;
  chiefDemonized: boolean;
  earthSpiritDemonized: boolean;
  guguBloodSkin: boolean;
  songJiangBondCount: number | string;
  astrologyHealthPercent: number | string;
  bloodChariotHealthPercent: number | string;
};

export type HealthCalculationResult = {
  config: HealthCalculatorConfig;
  totalBaseHealth: number;
  totalBonusPercent: number;
  totalHealth: number;
  formattedTotalHealth: string;
};

export const defaultHealthCalculatorConfig: HealthCalculatorConfig = {
  mainCardHealth: 6000000,
  subCardHealth: 5000000,
  equipment: "龙心",
  phantomSkin: "紫金铃铛",
  fullStarDeathLevel: "20",
  greenStarDeathLevel: "无",
  deathSkin: "万圣节死神",
  deathDemonized: true,
  priestCount: 3,
  chiefDemonized: true,
  earthSpiritDemonized: true,
  guguBloodSkin: true,
  songJiangBondCount: 3,
  astrologyHealthPercent: 0,
  bloodChariotHealthPercent: 0
};

export function calculateHealth(config: Partial<HealthCalculatorConfig> = {}): HealthCalculationResult {
  const resolved = normalizeHealthConfig(config);
  const totalBaseHealth = safeNumber(resolved.mainCardHealth) + safeNumber(resolved.subCardHealth);
  const totalBonusPercent = calculateTotalBonusPercent(resolved);
  const totalHealth = totalBaseHealth * (1 + totalBonusPercent / 100);

  return {
    config: resolved,
    totalBaseHealth,
    totalBonusPercent,
    totalHealth,
    formattedTotalHealth: formatHealthNumber(totalHealth)
  };
}

export function formatHealthNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 10000) return `${(value / 10000).toFixed(2)}万`;
  return `${Math.round(value)}`;
}

function normalizeHealthConfig(config: Partial<HealthCalculatorConfig>): HealthCalculatorConfig {
  return {
    ...defaultHealthCalculatorConfig,
    ...config,
    equipment: normalizeOption(config.equipment, healthCalculatorEquipmentOptions, defaultHealthCalculatorConfig.equipment),
    phantomSkin: normalizeOption(
      config.phantomSkin,
      healthCalculatorPhantomSkinOptions,
      defaultHealthCalculatorConfig.phantomSkin
    ),
    fullStarDeathLevel: normalizeOption(
      config.fullStarDeathLevel,
      healthCalculatorFullStarDeathOptions,
      defaultHealthCalculatorConfig.fullStarDeathLevel
    ),
    greenStarDeathLevel: normalizeOption(
      config.greenStarDeathLevel,
      healthCalculatorGreenStarDeathOptions,
      defaultHealthCalculatorConfig.greenStarDeathLevel
    ),
    deathSkin: normalizeOption(config.deathSkin, healthCalculatorDeathSkinOptions, defaultHealthCalculatorConfig.deathSkin)
  };
}

function normalizeOption<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function calculateTotalBonusPercent(config: HealthCalculatorConfig): number {
  return [
    equipmentHealthBonus(config.equipment),
    config.phantomSkin === "紫金铃铛" ? 25 : 0,
    fullStarDeathBonus(config.fullStarDeathLevel),
    greenStarDeathBonus(config.greenStarDeathLevel),
    config.deathSkin === "万圣节死神" ? 25 : 0,
    config.deathDemonized ? safeInteger(config.priestCount) * 10 : 0,
    config.chiefDemonized ? 25 : 0,
    config.earthSpiritDemonized ? 20 : 0,
    config.guguBloodSkin ? safeInteger(config.songJiangBondCount) * 15 : 0,
    safeNumber(config.astrologyHealthPercent),
    safeNumber(config.bloodChariotHealthPercent)
  ].reduce((sum, value) => sum + value, 0);
}

function equipmentHealthBonus(equipment: HealthCalculatorEquipment): number {
  return equipment === "龙心" ? 50 : 0;
}

function fullStarDeathBonus(level: HealthCalculatorFullStarDeathLevel): number {
  if (level === "8") return 120;
  if (level === "20") return 150;
  return 0;
}

function greenStarDeathBonus(level: HealthCalculatorGreenStarDeathLevel): number {
  if (level === "4") return 40;
  if (level === "16") return 50;
  return 0;
}

function safeNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function safeInteger(value: number | string): number {
  return Math.trunc(safeNumber(value));
}
