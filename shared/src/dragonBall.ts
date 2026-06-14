export type DragonBallElement = "暗" | "冰" | "雷" | "幻" | "魔" | "木" | "光" | "魂";
export type DragonBallProfession = "战士" | "法师" | "猎人" | "召唤" | "术士" | "牧师" | "熊猫" | "工程";
export type DragonBallPriceReferenceProfession = DragonBallProfession;
export type DragonBallQuality = "绿" | "蓝" | "紫" | "金" | "红";

export type DragonBallInfo = {
  element: DragonBallElement;
  profession: DragonBallProfession;
  quality: DragonBallQuality;
  attributes: string;
};

export const dragonBallProfessionOptions: readonly DragonBallProfession[] = [
  "战士",
  "法师",
  "猎人",
  "召唤",
  "术士",
  "牧师",
  "熊猫",
  "工程"
];

export const dragonBallPriceReferenceProfessionOptions: readonly DragonBallPriceReferenceProfession[] = [
  "战士",
  "法师",
  "猎人",
  "召唤",
  "术士",
  "牧师",
  "熊猫",
  "工程"
];

export const dragonBallQualityOptions: readonly DragonBallQuality[] = ["绿", "蓝", "紫", "金", "红"];

const elementByProfession: Record<DragonBallProfession, DragonBallElement> = {
  战士: "暗",
  法师: "冰",
  猎人: "雷",
  召唤: "幻",
  术士: "魔",
  牧师: "木",
  熊猫: "光",
  工程: "魂"
};

export function dragonBallElementForProfession(value: string): DragonBallElement | null {
  const profession = value.trim() as DragonBallProfession;
  return elementByProfession[profession] ?? null;
}

export function isDragonBallProfession(value: string): value is DragonBallProfession {
  return dragonBallElementForProfession(value) !== null;
}

export function isDragonBallPriceReferenceProfession(value: string): value is DragonBallPriceReferenceProfession {
  return dragonBallPriceReferenceProfessionOptions.includes(value.trim() as DragonBallPriceReferenceProfession);
}

export function isDragonBallQuality(value: string): value is DragonBallQuality {
  return dragonBallQualityOptions.includes(value.trim() as DragonBallQuality);
}
