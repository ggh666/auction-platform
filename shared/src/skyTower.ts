export type SkyTowerFloorType = "normal" | "elite";
export type SkyTowerHeroQuality = "yellow" | "green" | "orange" | "unknown";

export type SkyTowerFloorPage = {
  page: number;
  label: string;
  floors: number[];
};

export type SkyTowerRewardItem = {
  range: string;
  desc: string;
  amount: number;
  highlight: boolean;
};

export type SkyTowerHeroSlot = {
  position: string;
  name: string;
  quality: SkyTowerHeroQuality;
};

export type SkyTowerFloorInfo = {
  floor: number;
  type: SkyTowerFloorType;
  rewardAmount: number;
  rewardDesc: string;
  formationSummary: string;
  frontChariot: string[];
  backChariot: string[];
  heroSlots: SkyTowerHeroSlot[];
  tactics: string[];
};

export type SkyTowerFloorOverride = Pick<
  SkyTowerFloorInfo,
  "floor" | "formationSummary" | "frontChariot" | "backChariot" | "heroSlots" | "tactics"
>;

export class SkyTowerConfigParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkyTowerConfigParseError";
  }
}

export const skyTowerSections = [1, 2, 3, 4] as const;

export const skyTowerFloorPages: readonly SkyTowerFloorPage[] = skyTowerSections.map((page) => {
  const start = (page - 1) * 10 + 1;
  return {
    page,
    label: `${start}-${start + 9}层`,
    floors: Array.from({ length: 10 }, (_, index) => start + index)
  };
});

export const skyTowerRewards: readonly SkyTowerRewardItem[] = [
  { range: "1-9层", desc: "普通关卡", amount: 4, highlight: false },
  { range: "10层", desc: "精英关卡", amount: 10, highlight: true },
  { range: "11-19层", desc: "普通关卡", amount: 6, highlight: false },
  { range: "20层", desc: "精英关卡", amount: 15, highlight: true },
  { range: "21-29层", desc: "普通关卡", amount: 8, highlight: false },
  { range: "30层", desc: "精英关卡", amount: 20, highlight: true },
  { range: "31-39层", desc: "普通关卡", amount: 10, highlight: false },
  { range: "40层", desc: "精英关卡", amount: 25, highlight: true }
];

const placeholderFloorData: Pick<
  SkyTowerFloorInfo,
  "formationSummary" | "frontChariot" | "backChariot" | "heroSlots" | "tactics"
> = {
  formationSummary: "资料待补充",
  frontChariot: ["资料待补充"],
  backChariot: ["资料待补充"],
  heroSlots: [
    { position: "前车", name: "资料待补充", quality: "unknown" },
    { position: "后车", name: "资料待补充", quality: "unknown" }
  ],
  tactics: ["xiguaApp 当前源码未包含该层阵容明细，待后续补充真实数据。"]
};

export const skyTowerFloors: readonly SkyTowerFloorInfo[] = Array.from({ length: 40 }, (_, index) => {
  const floor = index + 1;
  const reward = rewardForFloor(floor);
  return {
    floor,
    type: floor % 10 === 0 ? "elite" : "normal",
    rewardAmount: reward.amount,
    rewardDesc: reward.desc,
    ...placeholderFloorData
  };
});

export function getSkyTowerFloor(floor: number): SkyTowerFloorInfo {
  const normalizedFloor = normalizeSkyTowerFloor(floor);
  return skyTowerFloors[normalizedFloor - 1] ?? skyTowerFloors[0];
}

export function parseSkyTowerConfigText(rawText: string): SkyTowerFloorOverride[] {
  const items: SkyTowerFloorOverride[] = [];
  const seenFloors = new Set<number>();
  const lines = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  lines.forEach((line, index) => {
    if (isSkyTowerHeaderLine(line)) {
      return;
    }
    const item = parseSkyTowerLine(line, index + 1);
    if (!item) {
      return;
    }
    if (seenFloors.has(item.floor)) {
      throw new SkyTowerConfigParseError(`第 ${index + 1} 行楼层重复`);
    }
    seenFloors.add(item.floor);
    items.push(item);
  });

  return items;
}

export function mergeSkyTowerFloorOverrides(
  overrides: readonly SkyTowerFloorOverride[],
  baseFloors: readonly SkyTowerFloorInfo[] = skyTowerFloors
): SkyTowerFloorInfo[] {
  const overrideByFloor = new Map(overrides.map((item) => [item.floor, item]));
  return baseFloors.map((floor) => {
    const override = overrideByFloor.get(floor.floor);
    if (!override) {
      return floor;
    }
    return {
      ...floor,
      formationSummary: override.formationSummary,
      frontChariot: override.frontChariot,
      backChariot: override.backChariot,
      heroSlots: override.heroSlots,
      tactics: override.tactics
    };
  });
}

export function normalizeSkyTowerFloor(floor: number): number {
  if (!Number.isFinite(floor)) {
    return 1;
  }
  return Math.min(40, Math.max(1, Math.trunc(floor)));
}

function isSkyTowerHeaderLine(line: string): boolean {
  const header = line
    .split("|")
    .map((part) => part.trim())
    .join("|");
  return header === "楼层|阵容说明|左侧战车|右侧战车|英雄位|战术备注" || header === "楼层|阵容说明|前车|后车|英雄位|战术备注";
}

function parseSkyTowerLine(line: string, lineNumber: number): SkyTowerFloorOverride | null {
  if (!line.trim()) {
    return null;
  }

  const parts = line.split("|").map((part) => part.trim());
  if (parts.length !== 6 || parts.some((part) => part.length === 0)) {
    throw new SkyTowerConfigParseError(`第 ${lineNumber} 行必须使用「楼层|阵容说明|左侧战车|右侧战车|英雄位|战术备注」格式`);
  }

  const floor = Number(parts[0]);
  if (!Number.isInteger(floor) || floor < 1 || floor > 40) {
    throw new SkyTowerConfigParseError(`第 ${lineNumber} 行楼层必须是 1-40`);
  }

  return {
    floor,
    formationSummary: assertLength(parts[1], 160, lineNumber, "阵容说明"),
    frontChariot: parseTextList(parts[2], lineNumber, "左侧战车"),
    backChariot: parseTextList(parts[3], lineNumber, "右侧战车"),
    heroSlots: parseHeroSlots(parts[4], lineNumber),
    tactics: parseTextList(parts[5], lineNumber, "战术备注")
  };
}

function assertLength(value: string, maxLength: number, lineNumber: number, fieldName: string): string {
  if (value.length > maxLength) {
    throw new SkyTowerConfigParseError(`第 ${lineNumber} 行${fieldName}过长`);
  }
  return value;
}

function parseTextList(value: string, lineNumber: number, fieldName: string): string[] {
  const items = value
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) {
    throw new SkyTowerConfigParseError(`第 ${lineNumber} 行${fieldName}不能为空`);
  }
  return items.map((item) => assertLength(item, 80, lineNumber, fieldName));
}

function parseHeroSlots(value: string, lineNumber: number): SkyTowerHeroSlot[] {
  return parseTextList(value, lineNumber, "英雄位").map((item) => {
    const parts = item.split(/[：:]/).map((part) => part.trim());
    if (parts.length < 2 || parts.length > 3 || parts.some((part) => part.length === 0)) {
      throw new SkyTowerConfigParseError(`第 ${lineNumber} 行英雄位必须使用「位置:英雄:品质」格式`);
    }
    const quality = (parts[2] ?? "unknown") as SkyTowerHeroQuality;
    if (!["yellow", "green", "orange", "unknown"].includes(quality)) {
      throw new SkyTowerConfigParseError(`第 ${lineNumber} 行英雄品质必须是 yellow/green/orange/unknown`);
    }
    return {
      position: assertLength(parts[0], 24, lineNumber, "英雄位置"),
      name: assertLength(parts[1], 40, lineNumber, "英雄名称"),
      quality
    };
  });
}

function rewardForFloor(floor: number): SkyTowerRewardItem {
  if (floor === 10) {
    return skyTowerRewards[1];
  }
  if (floor < 10) {
    return skyTowerRewards[0];
  }
  if (floor === 20) {
    return skyTowerRewards[3];
  }
  if (floor < 20) {
    return skyTowerRewards[2];
  }
  if (floor === 30) {
    return skyTowerRewards[5];
  }
  if (floor < 30) {
    return skyTowerRewards[4];
  }
  if (floor === 40) {
    return skyTowerRewards[7];
  }
  return skyTowerRewards[6];
}
