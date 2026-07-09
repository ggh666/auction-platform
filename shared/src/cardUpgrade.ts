export const cardUpgradeTypeOptions = [
  { type: "gold", name: "金卡" },
  { type: "purple", name: "紫卡" },
  { type: "blue", name: "蓝卡" },
  { type: "green", name: "绿卡" }
] as const;

export type CardUpgradeType = (typeof cardUpgradeTypeOptions)[number]["type"];

export type CardUpgradeConfig = {
  cardType: CardUpgradeType;
  currentLevel: number | string;
  targetLevel: number | string;
  currentCount: number | string;
};

export type CardUpgradeResult = {
  config: CardUpgradeConfig;
  cardTypeName: string;
  currentLevel: number;
  targetLevel: number;
  currentCount: number;
  requiredCardCount: number;
  devilFruitCount: number;
  formattedRequiredCards: string;
  formattedDevilFruit: string;
};

const minLevel = 1;
const maxLevel = 25;

const cardCostsByType: Record<CardUpgradeType, number[]> = {
  gold: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90],
  purple: [2, 3, 8, 16, 24, 32, 40, 48, 56, 64, 80, 100, 120, 140, 160, 200, 240, 280, 320, 400, 480, 560, 640, 720],
  blue: [5, 10, 20, 40, 60, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000, 4500],
  green: [10, 20, 40, 80, 150, 300, 500, 1000, 1500, 2500, 3000, 3500, 4000, 4500, 5000, 6250, 7500, 8750, 10000, 12500, 15000, 17500, 20000, 22500]
};

export const defaultCardUpgradeConfig: CardUpgradeConfig = {
  cardType: "gold",
  currentLevel: 1,
  targetLevel: 24,
  currentCount: 0
};

export function calculateCardUpgrade(config: Partial<CardUpgradeConfig> = {}): CardUpgradeResult {
  const resolved = normalizeCardUpgradeConfig(config);
  const currentLevel = safeLevel(resolved.currentLevel, defaultCardUpgradeConfig.currentLevel as number);
  const targetLevel = safeLevel(resolved.targetLevel, defaultCardUpgradeConfig.targetLevel as number);
  const currentCount = safeInteger(resolved.currentCount);
  const cardCost = sumRange(cardCostsByType[resolved.cardType], currentLevel, targetLevel);
  const requiredCardCount = Math.max(cardCost - currentCount, 0);
  const devilFruitCount = calculateDevilFruit(currentLevel, targetLevel);

  return {
    config: {
      ...resolved,
      currentLevel,
      targetLevel,
      currentCount
    },
    cardTypeName: cardUpgradeTypeName(resolved.cardType),
    currentLevel,
    targetLevel,
    currentCount,
    requiredCardCount,
    devilFruitCount,
    formattedRequiredCards: `${requiredCardCount} 张`,
    formattedDevilFruit: `${devilFruitCount} 恶魔果`
  };
}

function normalizeCardUpgradeConfig(config: Partial<CardUpgradeConfig>): CardUpgradeConfig {
  const cardType = cardUpgradeTypeOptions.some((option) => option.type === config.cardType)
    ? (config.cardType as CardUpgradeType)
    : defaultCardUpgradeConfig.cardType;
  return {
    ...defaultCardUpgradeConfig,
    ...config,
    cardType
  };
}

function cardUpgradeTypeName(type: CardUpgradeType): string {
  return cardUpgradeTypeOptions.find((option) => option.type === type)?.name ?? "金卡";
}

function sumRange(costs: number[], currentLevel: number, targetLevel: number): number {
  if (targetLevel <= currentLevel) return 0;
  let total = 0;
  for (let level = currentLevel; level < targetLevel; level += 1) {
    total += costs[level - 1] ?? 0;
  }
  return total;
}

function calculateDevilFruit(currentLevel: number, targetLevel: number): number {
  if (targetLevel <= currentLevel) return 0;
  let total = 0;
  for (let level = currentLevel; level < targetLevel; level += 1) {
    if (level >= 20) {
      total += 10 + (level - 20) * 5;
    }
  }
  return total;
}

function safeLevel(value: number | string, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), minLevel), maxLevel);
}

function safeInteger(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}
