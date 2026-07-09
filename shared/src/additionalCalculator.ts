export const additionalCalculatorSirenLevelOptions = ["无", "9", "18"] as const;
export const additionalCalculatorSirenSkinOptions = ["无", "太平乐"] as const;
export const additionalCalculatorBoneBowSkinOptions = ["无", "文徵明"] as const;

export type AdditionalCalculatorSirenLevel = (typeof additionalCalculatorSirenLevelOptions)[number];
export type AdditionalCalculatorSirenSkin = (typeof additionalCalculatorSirenSkinOptions)[number];
export type AdditionalCalculatorBoneBowSkin = (typeof additionalCalculatorBoneBowSkinOptions)[number];

export type AdditionalDamageCalculatorConfig = {
  fixedAdditionalDamage: number | string;
  sirenLevel: AdditionalCalculatorSirenLevel;
  sirenSkin: AdditionalCalculatorSirenSkin;
  sirenDemonized: boolean;
  guguDemonized: boolean;
  demonizedHeroCount: number | string;
  boneBowSkin: AdditionalCalculatorBoneBowSkin;
  witchDoctorDemonized: boolean;
};

export type AdditionalDamageCalculationResult = {
  config: AdditionalDamageCalculatorConfig;
  baseAdditionalDamage: number;
  totalBonusPercent: number;
  totalAdditionalDamage: number;
  formattedAdditionalDamage: string;
};

export const defaultAdditionalDamageCalculatorConfig: AdditionalDamageCalculatorConfig = {
  fixedAdditionalDamage: 600000,
  sirenLevel: "18",
  sirenSkin: "无",
  sirenDemonized: true,
  guguDemonized: true,
  demonizedHeroCount: 7,
  boneBowSkin: "无",
  witchDoctorDemonized: false
};

export function calculateAdditionalDamage(
  config: Partial<AdditionalDamageCalculatorConfig> = {}
): AdditionalDamageCalculationResult {
  const resolved = normalizeAdditionalDamageConfig(config);
  const baseAdditionalDamage = safeNumber(resolved.fixedAdditionalDamage);
  const totalBonusPercent = calculateTotalBonusPercent(resolved);
  const totalAdditionalDamage = roundDamage(baseAdditionalDamage * (1 + totalBonusPercent / 100));

  return {
    config: resolved,
    baseAdditionalDamage,
    totalBonusPercent,
    totalAdditionalDamage,
    formattedAdditionalDamage: formatAdditionalDamageNumber(totalAdditionalDamage)
  };
}

export function formatAdditionalDamageNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 10000) return `${(value / 10000).toFixed(4)}万`;
  return `${Math.round(value)}`;
}

function normalizeAdditionalDamageConfig(
  config: Partial<AdditionalDamageCalculatorConfig>
): AdditionalDamageCalculatorConfig {
  return {
    ...defaultAdditionalDamageCalculatorConfig,
    ...config,
    sirenLevel: normalizeOption(
      config.sirenLevel,
      additionalCalculatorSirenLevelOptions,
      defaultAdditionalDamageCalculatorConfig.sirenLevel
    ),
    sirenSkin: normalizeOption(
      config.sirenSkin,
      additionalCalculatorSirenSkinOptions,
      defaultAdditionalDamageCalculatorConfig.sirenSkin
    ),
    boneBowSkin: normalizeOption(
      config.boneBowSkin,
      additionalCalculatorBoneBowSkinOptions,
      defaultAdditionalDamageCalculatorConfig.boneBowSkin
    )
  };
}

function normalizeOption<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function calculateTotalBonusPercent(config: AdditionalDamageCalculatorConfig): number {
  return [
    sirenLevelBonus(config.sirenLevel),
    config.sirenSkin === "太平乐" ? 50 : 0,
    config.sirenDemonized ? 50 : 0,
    config.guguDemonized ? safeInteger(config.demonizedHeroCount) * 10 : 0,
    config.boneBowSkin === "文徵明" ? 30 : 0,
    config.witchDoctorDemonized ? 30 : 0
  ].reduce((sum, value) => sum + value, 0);
}

function sirenLevelBonus(level: AdditionalCalculatorSirenLevel): number {
  if (level === "9") return 50;
  if (level === "18") return 100;
  return 0;
}

function safeNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function safeInteger(value: number | string): number {
  return Math.trunc(safeNumber(value));
}

function roundDamage(value: number): number {
  return Math.round(value * 10000) / 10000;
}
