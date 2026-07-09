export type DeepSeaCellType = "main-city" | "boss" | "royal-city";

export type DeepSeaMapCell = {
  type: DeepSeaCellType;
  icon: string;
  name: string;
  section: number | null;
  toastName?: string;
};

export type DeepSeaBoss = {
  section: number;
  name: string;
  icon: string;
  attackType: string;
};

export type DeepSeaSelectedEquipment = {
  isRed: boolean;
  typeIndex: number;
  typeName: string;
};

export type DeepSeaHealthConfig = {
  mainHealth: number | string;
  healthBonus: number | string;
  chiefDemonized: boolean;
  guguBloodSkin: boolean;
  coreCount: number | string;
  deathLevel: number;
  deathSkinType: number;
  deathDemonized: boolean;
  notFullDeath: boolean;
  notFullDeathLevel: number;
  priestCount: number | string;
};

export type DeepSeaMagicResistanceConfig = {
  magicResistance: number | string;
  magicResistancePercent: number | string;
  magicResistanceChariot: number | string;
  sirenDemonized: boolean;
  sirenSkin: boolean;
  sirenLevel: number;
  notFullSiren: boolean;
  notFullSirenLevel: number;
  priestCount: boolean;
  chief12Level: boolean;
  gugu24: boolean;
  coreCount: number | string;
  boneBow: boolean;
  boneBowLevel: number;
  boneBowDemonized: boolean;
  tentacleDoll: boolean;
  pinkDeath: boolean;
};

export type DeepSeaArmorResistanceConfig = {
  armor: number | string;
  armorPercent: number | string;
  armorChariot: number | string;
  steelManeDemonized: boolean;
  steelManeSkin: boolean;
  steelManeSkinType: number;
  steelManeLevel: number;
  warriorCount: number | string;
  notFullSteelMane: boolean;
  notFullSteelManeLevel: number;
  chief12Level: boolean;
  gugu24Level: boolean;
  guguCoreCount: number | string;
  pinkDeath: boolean;
};

export type DeepSeaPureResistanceConfig = {
  pureResistance: number | string;
  pureResistanceChariot: number | string;
  iceKnightLevel: number;
  iceKnightSkin: boolean;
  iceKnightDemonized: boolean;
  notFullIceKnight: boolean;
  notFullIceKnightLevel: number;
  gugu24: boolean;
  coreCount: number | string;
  tentacleDoll: boolean;
};

export type DeepSeaTrueDamageResistanceConfig = {
  trueDamageResistance: number | string;
  trueDamageResistanceChariot: number | string;
  rayDemonized: boolean;
  raySkin: boolean;
  rayLevel: number;
};

export type DeepSeaElementResistanceConfig = {
  elementResistancePercent: number | string;
  earthSpiritLevel: number;
  earthSpirit12Level: number;
  pandaCount: number | string;
  earthSpiritSkin: boolean;
  earthSpiritDemonized: boolean;
  zhiduoxing: boolean;
};

export type DeepSeaCraftsmanConfig = {
  craftsmanLevel: number;
  craftsmanDemonized: boolean;
  craftsmanSkin: boolean;
  notFullCraftsman: boolean;
  notFullCraftsmanLevel: number;
};

export type DeepSeaDamageResistanceConfig = {
  damageResistance: number | string;
  damageResistanceChariot: number | string;
  chiefLevel: number;
  chiefSkin: boolean;
  chiefSkinType: number;
  wildLevel: number;
  guguDamageReductionSkin: boolean;
  coreCount: number | string;
  wukongSummon: number;
  wukongLevel: number;
};

export type DeepSeaAdditionalDamageResistanceConfig = {
  airship: number | string;
  raySkin: boolean;
};

export type DeepSeaHealthPercentResistanceConfig = {
  healthPercentResistance: number | string;
  submarineLevelIndex: number;
  submarineDemonized: boolean;
  submarineSkin: boolean;
};

export type DeepSeaAttackReductionConfig = {
  wukongEnabled: boolean;
  wukongLevel: number;
  wukongSummon3: boolean;
  wukongSummon5: boolean;
  wukongDemonized: boolean;
  rayEnabled: boolean;
  rayLevel: number;
};

export type DeepSeaEquipmentStats = {
  healthPercent: number;
  magicResistance: number;
  magicResistancePercent: number;
  armor: number;
  armorPercent: number;
  pureResistance: number;
};

export type DeepSeaCalculatorData = {
  health: number;
  damageReduction: number;
  effectiveDamageReduction: number;
  magicResistanceReduction: number;
  effectiveMagicResistance: number;
  armorReduction: number;
  effectiveArmorResistance: number;
  pureReduction: number;
  effectivePureReduction: number;
  elementReduction: number;
  effectiveElementResistance: number;
  trueDamageReduction: number;
  effectiveTrueDamageResistance: number;
  additionalDamageReduction: number;
  effectiveAdditionalDamageResistance: number;
  healthPercentReduction: number;
  attackReduction: number;
  effectiveAttackReduction: number;
  critReduction: number;
  critDamageReduction: number;
  effectiveCritRate: number;
  effectiveCritDamage: number;
};

export type DeepSeaBossCalculationData = {
  baseAttack: number;
  attackBonus: number;
  skillCoeff: number;
  damageBonus: number;
  critDamage: number;
  percentDamageCoeff: number;
  czMultiplier: number;
  additionalDamage: number;
  magicPenetrationPercent: number;
  magicPenetration: number;
  armorPenetrationPercent: number;
  armorPenetration: number;
  pureDamageBonus: number;
  pureResistancePenetration: number;
  elementDamageBonus: number;
  trueDamageBonus: number;
  additionalDamageBonus: number;
  attackType: string;
  attackReductionPerMember: number;
  hasPercentDamage: boolean;
  hasAdditionalDamage: boolean;
  showHealth: boolean;
  showDamageReduction: boolean;
  showAttackReduction: boolean;
  showMagicResistanceReduction: boolean;
  showArmorReduction: boolean;
  showPureReduction: boolean;
  showElementReduction: boolean;
  showTrueDamageReduction: boolean;
  showAdditionalDamageReduction: boolean;
  showHealthPercentReduction: boolean;
  showEquipment: boolean;
  showSquadMemberCount: boolean;
};

export type DeepSeaCalculatorState = {
  section: number;
  level: number;
  boss: DeepSeaBoss;
  selectedEquipment: DeepSeaSelectedEquipment;
  equipmentStats: DeepSeaEquipmentStats;
  healthConfig: DeepSeaHealthConfig;
  magicResistanceConfig: DeepSeaMagicResistanceConfig;
  armorResistanceConfig: DeepSeaArmorResistanceConfig;
  pureResistanceConfig: DeepSeaPureResistanceConfig;
  trueDamageResistanceConfig: DeepSeaTrueDamageResistanceConfig;
  elementResistanceConfig: DeepSeaElementResistanceConfig;
  craftsmanConfig: DeepSeaCraftsmanConfig;
  damageResistanceConfig: DeepSeaDamageResistanceConfig;
  additionalDamageResistanceConfig: DeepSeaAdditionalDamageResistanceConfig;
  healthPercentResistanceConfig: DeepSeaHealthPercentResistanceConfig;
  attackReductionConfig: DeepSeaAttackReductionConfig;
  squadMemberCount: number;
};

export type DeepSeaCalculatorOverrides = {
  selectedEquipment?: Partial<DeepSeaSelectedEquipment>;
  healthConfig?: Partial<DeepSeaHealthConfig>;
  magicResistanceConfig?: Partial<DeepSeaMagicResistanceConfig>;
  armorResistanceConfig?: Partial<DeepSeaArmorResistanceConfig>;
  pureResistanceConfig?: Partial<DeepSeaPureResistanceConfig>;
  trueDamageResistanceConfig?: Partial<DeepSeaTrueDamageResistanceConfig>;
  elementResistanceConfig?: Partial<DeepSeaElementResistanceConfig>;
  craftsmanConfig?: Partial<DeepSeaCraftsmanConfig>;
  damageResistanceConfig?: Partial<DeepSeaDamageResistanceConfig>;
  additionalDamageResistanceConfig?: Partial<DeepSeaAdditionalDamageResistanceConfig>;
  healthPercentResistanceConfig?: Partial<DeepSeaHealthPercentResistanceConfig>;
  attackReductionConfig?: Partial<DeepSeaAttackReductionConfig>;
  squadMemberCount?: number;
};

export type DeepSeaCalculationInput = {
  section: number;
  level: number;
  overrides?: DeepSeaCalculatorOverrides;
};

export type DeepSeaCalculationResult = {
  boss: DeepSeaBoss;
  level: number;
  levelOptions: readonly number[];
  state: DeepSeaCalculatorState;
  bossCalculationData: DeepSeaBossCalculationData;
  calculatorData: DeepSeaCalculatorData;
  calculatedTotalHealth: number;
  formattedTotalHealth: string;
  finalDamage: number;
  formattedFinalDamage: string;
  finalDamageSingle: number;
  finalDamageTotal: number;
  formattedSingleDamage: string;
  formattedTotalDamage: string;
  critDamage: number;
  formattedCritDamage: string;
  trueDamage: number | null;
  physicalDamage: number | null;
  magicDamage: number | null;
  formattedTrueDamage: string;
  formattedPhysicalDamage: string;
  formattedMagicDamage: string;
  chainsawDamage: number | null;
  chainsawDamage4x: number | null;
  formattedChainsawDamage: string;
  formattedChainsawDamage4x: string;
};

export const deepSeaMapRows: readonly (readonly DeepSeaMapCell[])[] = [
  [
    { type: "main-city", icon: "城", name: "天灾", section: null, toastName: "幽暗水牢" },
    { type: "boss", icon: "魔", name: "魔鬼", section: 1 },
    { type: "boss", icon: "营", name: "典狱长", section: 2 },
    { type: "boss", icon: "卫", name: "禁卫", section: 3 },
    { type: "main-city", icon: "城", name: "人类", section: null, toastName: "深海王宫" }
  ],
  [
    { type: "boss", icon: "乌", name: "乌贼", section: 4 },
    { type: "boss", icon: "兽", name: "异兽", section: 5 },
    { type: "boss", icon: "门", name: "北门·魅影", section: 6 },
    { type: "boss", icon: "主", name: "公主", section: 7 },
    { type: "boss", icon: "刺", name: "刺豚", section: 8 }
  ],
  [
    { type: "boss", icon: "怪", name: "怪人", section: 9 },
    { type: "boss", icon: "简", name: "西门·简", section: 10 },
    { type: "royal-city", icon: "王", name: "王城", section: 11 },
    { type: "boss", icon: "简", name: "东门·简", section: 10 },
    { type: "boss", icon: "怪", name: "怪人", section: 9 }
  ],
  [
    { type: "boss", icon: "刺", name: "刺豚", section: 8 },
    { type: "boss", icon: "主", name: "公主", section: 7 },
    { type: "boss", icon: "门", name: "南门·魅影", section: 6 },
    { type: "boss", icon: "兽", name: "异兽", section: 5 },
    { type: "boss", icon: "乌", name: "乌贼", section: 4 }
  ],
  [
    { type: "main-city", icon: "城", name: "暗月", section: null, toastName: "远古珊瑚" },
    { type: "boss", icon: "卫", name: "禁卫", section: 3 },
    { type: "boss", icon: "营", name: "典狱长", section: 2 },
    { type: "boss", icon: "魔", name: "魔鬼", section: 1 },
    { type: "main-city", icon: "城", name: "兽人", section: null, toastName: "腐蚀之息" }
  ]
];

export const deepSeaBosses: readonly DeepSeaBoss[] = [
  { section: 1, name: "魔鬼", icon: "魔", attackType: "魔法攻击" },
  { section: 2, name: "典狱长", icon: "营", attackType: "纯粹伤害" },
  { section: 3, name: "禁卫", icon: "卫", attackType: "物理伤害" },
  { section: 4, name: "乌贼", icon: "乌", attackType: "元素攻击" },
  { section: 5, name: "异兽", icon: "兽", attackType: "真实伤害" },
  { section: 6, name: "魅影", icon: "门", attackType: "魔法攻击" },
  { section: 7, name: "公主", icon: "主", attackType: "元素攻击" },
  { section: 8, name: "刺豚", icon: "刺", attackType: "真实伤害" },
  { section: 9, name: "怪人", icon: "怪", attackType: "魔法攻击" },
  { section: 10, name: "简", icon: "简", attackType: "纯粹伤害" },
  { section: 11, name: "王城", icon: "王", attackType: "多种伤害类型" }
];

export const deepSeaLevelOptions: Readonly<Record<number, readonly number[]>> = {
  1: [50, 60, 70, 80, 90, 100],
  2: [50, 60, 70, 80, 90, 100, 110, 120],
  3: [50, 60, 70, 80, 90, 100],
  4: [50, 60, 70, 80, 90, 100],
  5: [50, 60, 70, 80, 90, 100],
  6: [50, 60, 70, 80, 90, 100, 110],
  7: [50, 60, 70, 80, 90, 100],
  8: [50, 60, 70, 80, 90, 100],
  9: [50, 60, 70, 80, 90, 100],
  10: [50, 60, 70, 80, 90, 100, 110],
  11: [60, 70, 80, 90, 100, 110, 120, 130]
};

export const deepSeaEquipmentOptions = ["龙心", "烟斗", "强袭"] as const;
export const deepSeaDeathLevelOptions = ["0级", "1级", "8级", "20级"] as const;
export const deepSeaNotFullDeathLevelOptions = ["1级", "4级", "16级"] as const;
export const deepSeaSirenLevelOptions = ["0级", "1级", "8级", "20级", "24级"] as const;
export const deepSeaSteelManeLevelOptions = ["0级", "1级", "8级", "12级", "20级", "24级"] as const;
export const deepSeaEarthSpiritLevelOptions = ["0级", "1级", "8级", "12级", "20级", "24级"] as const;
export const deepSeaIceKnightLevelOptions = ["0级", "1级", "8级", "20级", "24级"] as const;
export const deepSeaRayLevelOptions = ["0级", "1级", "6级", "15级", "24级"] as const;
export const deepSeaSubmarineLevelOptions = ["无", "1级", "6级", "15级", "24级"] as const;
export const deepSeaChiefLevelOptions = ["0级", "1级", "8级", "12级", "20级", "24级"] as const;
export const deepSeaWildLevelOptions = ["无", "1级", "9级", "18级"] as const;
export const deepSeaChiefSkinTypeOptions = ["无", "奶牛·酋长", "粉色奶牛·酋长"] as const;
export const deepSeaDeathSkinTypeOptions = ["无", "万圣节·死神", "粉色南瓜·死神"] as const;
export const deepSeaBoneBowLevelOptions = ["4级", "16级"] as const;
export const deepSeaNotFullSirenLevelOptions = ["1级", "4级", "16级"] as const;
export const deepSeaNotFullSteelManeLevelOptions = ["1级", "4级", "16级"] as const;
export const deepSeaNotFullIceKnightLevelOptions = ["1级", "4级", "16级"] as const;
export const deepSeaCraftsmanLevelOptions = ["0级", "1级", "8级", "12级", "20级", "24级"] as const;
export const deepSeaNotFullCraftsmanLevelOptions = ["4级", "16级"] as const;

const VALUES = {
  earthSpiritDemonized: 20,
  earthSpiritSkin: 10,
  guguBloodSkin: 15,
  guguDamageReductionSkin: 10,
  sirenDemonized: 20,
  sirenSkin: 20,
  boneBowDemonized: 10,
  tentacleDoll: 20,
  steelManeDemonized: 20,
  iceKnightDemonized: 10,
  iceKnightSkin: 10,
  notFullIceKnight: 40,
  rayDemonized: 5,
  raySkin: 5,
  raySkinAdditional: 25,
  submarineDemonized: 10,
  submarineSkin: 10,
  deathDemonized: 10,
  deathLevels: {
    1: { notFull: 30, full: 90 },
    2: { notFull: 40, full: 40 },
    3: { notFull: 120, full: 120 },
    4: { notFull: 50, full: 50 },
    5: { notFull: 150, full: 150 }
  },
  deathSkins: {
    1: { health: 25 },
    2: { armor: 20, magicResistance: 20 }
  },
  sirenLevels: {
    1: { notFull: 15, full: 35 },
    2: { notFull: 20, full: 45 },
    3: { notFull: 25, full: 60 },
    4: { notFull: 0, full: 60, additional: 50 }
  },
  boneBowLevels: { 4: 10, 16: 15 },
  steelManeLevels: {
    1: { armor: 35 },
    2: { armor: 20 },
    3: { armor: 45 },
    4: { armorPerWarrior: 5 },
    5: { armor: 25 },
    6: { armor: 60 },
    7: { armorPercent: 50 }
  },
  steelManeSkin: { 1: 10, 2: 20 },
  earthSpiritLevels: { 1: 40, 3: 60, 6: 70, 7: 80 },
  iceKnightLevels: { 1: 75, 2: 50, 3: 80, 4: 60, 5: 90, 6: 10 },
  submarineLevels: { 1: 40, 2: 50, 3: 60, 4: 70 },
  wukong: {
    3: { 1: 20, 4: 25, 16: 30 },
    5: { 1: 50, 4: 55, 8: 60, 20: 65 }
  }
} as const;

const defaultCalculatorData: DeepSeaCalculatorData = {
  health: 0,
  damageReduction: 0,
  effectiveDamageReduction: 0,
  magicResistanceReduction: 0,
  effectiveMagicResistance: 0,
  armorReduction: 0,
  effectiveArmorResistance: 0,
  pureReduction: 0,
  effectivePureReduction: 0,
  elementReduction: 0,
  effectiveElementResistance: 0,
  trueDamageReduction: 0,
  effectiveTrueDamageResistance: 0,
  additionalDamageReduction: 0,
  effectiveAdditionalDamageResistance: 0,
  healthPercentReduction: 0,
  attackReduction: 0,
  effectiveAttackReduction: 0,
  critReduction: 0,
  critDamageReduction: 0,
  effectiveCritRate: 0,
  effectiveCritDamage: 0
};

const baseState: Omit<DeepSeaCalculatorState, "section" | "level" | "boss"> = {
  selectedEquipment: { isRed: false, typeIndex: -1, typeName: "" },
  equipmentStats: {
    healthPercent: 0,
    magicResistance: 0,
    magicResistancePercent: 0,
    armor: 0,
    armorPercent: 0,
    pureResistance: 0
  },
  healthConfig: {
    mainHealth: 16000000,
    healthBonus: 0,
    chiefDemonized: false,
    guguBloodSkin: false,
    coreCount: 0,
    deathLevel: 0,
    deathSkinType: 0,
    deathDemonized: false,
    notFullDeath: false,
    notFullDeathLevel: 0,
    priestCount: 0
  },
  magicResistanceConfig: {
    magicResistance: 0,
    magicResistancePercent: 0,
    magicResistanceChariot: 0,
    sirenDemonized: false,
    sirenSkin: false,
    sirenLevel: 0,
    notFullSiren: false,
    notFullSirenLevel: 0,
    priestCount: false,
    chief12Level: false,
    gugu24: false,
    coreCount: 0,
    boneBow: false,
    boneBowLevel: 0,
    boneBowDemonized: false,
    tentacleDoll: false,
    pinkDeath: false
  },
  armorResistanceConfig: {
    armor: 0,
    armorPercent: 0,
    armorChariot: 0,
    steelManeDemonized: false,
    steelManeSkin: false,
    steelManeSkinType: 0,
    steelManeLevel: 0,
    warriorCount: 0,
    notFullSteelMane: false,
    notFullSteelManeLevel: 0,
    chief12Level: false,
    gugu24Level: false,
    guguCoreCount: 0,
    pinkDeath: false
  },
  pureResistanceConfig: {
    pureResistance: 0,
    pureResistanceChariot: 0,
    iceKnightLevel: 0,
    iceKnightSkin: false,
    iceKnightDemonized: false,
    notFullIceKnight: false,
    notFullIceKnightLevel: 0,
    gugu24: false,
    coreCount: 0,
    tentacleDoll: false
  },
  trueDamageResistanceConfig: {
    trueDamageResistance: 0,
    trueDamageResistanceChariot: 0,
    rayDemonized: false,
    raySkin: false,
    rayLevel: 0
  },
  elementResistanceConfig: {
    elementResistancePercent: 0,
    earthSpiritLevel: 3,
    earthSpirit12Level: 0,
    pandaCount: 2,
    earthSpiritSkin: true,
    earthSpiritDemonized: false,
    zhiduoxing: false
  },
  craftsmanConfig: {
    craftsmanLevel: 0,
    craftsmanDemonized: false,
    craftsmanSkin: false,
    notFullCraftsman: false,
    notFullCraftsmanLevel: 0
  },
  damageResistanceConfig: {
    damageResistance: 0,
    damageResistanceChariot: 0,
    chiefLevel: 0,
    chiefSkin: false,
    chiefSkinType: 0,
    wildLevel: 0,
    guguDamageReductionSkin: false,
    coreCount: 0,
    wukongSummon: 0,
    wukongLevel: 0
  },
  additionalDamageResistanceConfig: {
    airship: 0,
    raySkin: false
  },
  healthPercentResistanceConfig: {
    healthPercentResistance: 0,
    submarineLevelIndex: 0,
    submarineDemonized: false,
    submarineSkin: false
  },
  attackReductionConfig: {
    wukongEnabled: false,
    wukongLevel: 0,
    wukongSummon3: false,
    wukongSummon5: false,
    wukongDemonized: false,
    rayEnabled: true,
    rayLevel: 3
  },
  squadMemberCount: 5
};

const specialStateBySection: Readonly<Record<number, DeepSeaCalculatorOverrides>> = {
  1: {
    damageResistanceConfig: blankDamageResistanceConfig(),
    magicResistanceConfig: {
      magicResistanceChariot: 57,
      sirenDemonized: true,
      sirenSkin: true,
      sirenLevel: 3,
      chief12Level: true,
      gugu24: true,
      coreCount: 5,
      boneBow: true,
      boneBowLevel: 1,
      tentacleDoll: true
    },
    attackReductionConfig: defaultRayAttackReduction(),
    elementResistanceConfig: {
      earthSpiritLevel: 0,
      pandaCount: 0,
      earthSpiritSkin: false
    },
    selectedEquipment: redEquipment(1, "烟斗")
  },
  2: {
    damageResistanceConfig: blankDamageResistanceConfig(),
    pureResistanceConfig: {
      pureResistance: 0,
      pureResistanceChariot: 50,
      coreCount: 5,
      gugu24: true,
      tentacleDoll: true,
      iceKnightLevel: 3,
      iceKnightSkin: true,
      iceKnightDemonized: true
    },
    attackReductionConfig: defaultRayAttackReduction(),
    healthConfig: { mainHealth: 16000000 },
    selectedEquipment: redEquipment(0, "龙心")
  },
  3: {
    armorResistanceConfig: {
      armorChariot: 0,
      steelManeLevel: 4,
      steelManeDemonized: true,
      steelManeSkin: true,
      steelManeSkinType: 2,
      warriorCount: 1,
      chief12Level: true,
      gugu24Level: true,
      guguCoreCount: 3
    },
    selectedEquipment: redEquipment(2, "强袭"),
    squadMemberCount: 12
  },
  4: {},
  5: {
    damageResistanceConfig: blankDamageResistanceConfig(),
    trueDamageResistanceConfig: {
      rayDemonized: true,
      raySkin: true,
      rayLevel: 4
    },
    attackReductionConfig: defaultRayAttackReduction(),
    selectedEquipment: redEquipment(0, "龙心")
  },
  6: {
    damageResistanceConfig: blankDamageResistanceConfig(),
    magicResistanceConfig: {
      magicResistanceChariot: 70,
      sirenLevel: 3,
      sirenSkin: true,
      sirenDemonized: true,
      gugu24: true,
      coreCount: 5,
      boneBow: true,
      boneBowLevel: 1,
      boneBowDemonized: true,
      chief12Level: true
    },
    attackReductionConfig: defaultRayAttackReduction(),
    healthConfig: { mainHealth: 16000000 },
    selectedEquipment: redEquipment(1, "烟斗")
  },
  7: {
    damageResistanceConfig: blankDamageResistanceConfig(),
    trueDamageResistanceConfig: {
      rayLevel: 4
    },
    attackReductionConfig: defaultRayAttackReduction(),
    elementResistanceConfig: {
      earthSpiritLevel: 4,
      pandaCount: 2,
      earthSpiritSkin: true,
      earthSpiritDemonized: true
    }
  },
  8: {
    damageResistanceConfig: blankDamageResistanceConfig(),
    trueDamageResistanceConfig: {
      rayDemonized: true,
      raySkin: true,
      rayLevel: 4
    },
    attackReductionConfig: defaultRayAttackReduction(),
    healthConfig: { mainHealth: 16000000 },
    selectedEquipment: redEquipment(0, "龙心")
  },
  9: {
    damageResistanceConfig: blankDamageResistanceConfig(),
    magicResistanceConfig: {
      magicResistanceChariot: 50,
      sirenDemonized: true,
      sirenSkin: true,
      sirenLevel: 3,
      gugu24: true,
      coreCount: 5,
      tentacleDoll: true
    },
    attackReductionConfig: defaultRayAttackReduction(),
    craftsmanConfig: {
      craftsmanLevel: 3
    },
    selectedEquipment: redEquipment(1, "烟斗")
  },
  10: {
    pureResistanceConfig: {
      iceKnightLevel: 3,
      iceKnightSkin: true,
      iceKnightDemonized: true,
      gugu24: true,
      coreCount: 5
    },
    damageResistanceConfig: blankDamageResistanceConfig(),
    healthPercentResistanceConfig: {
      submarineLevelIndex: 4,
      submarineDemonized: true,
      submarineSkin: true
    },
    attackReductionConfig: {
      rayEnabled: true,
      rayLevel: 18
    },
    selectedEquipment: redEquipment(0, "龙心")
  },
  11: {
    damageResistanceConfig: blankDamageResistanceConfig(),
    magicResistanceConfig: {
      magicResistanceChariot: 0,
      sirenLevel: 3,
      sirenSkin: true,
      sirenDemonized: true,
      gugu24: true,
      coreCount: 5,
      chief12Level: true
    },
    armorResistanceConfig: {
      armorChariot: 50,
      steelManeLevel: 4,
      steelManeDemonized: true,
      steelManeSkin: true,
      steelManeSkinType: 2,
      warriorCount: 1,
      chief12Level: true
    },
    elementResistanceConfig: {
      earthSpiritDemonized: true
    },
    trueDamageResistanceConfig: {
      rayDemonized: true,
      raySkin: true,
      rayLevel: 4
    },
    additionalDamageResistanceConfig: {
      airship: 50,
      raySkin: true
    },
    attackReductionConfig: defaultRayAttackReduction(),
    healthConfig: { mainHealth: 16000000 },
    selectedEquipment: redEquipment(1, "烟斗")
  }
};

export function getDeepSeaBoss(section: number): DeepSeaBoss {
  return deepSeaBosses.find((boss) => boss.section === section) ?? {
    section,
    name: "深海之战BOSS",
    icon: "海",
    attackType: "未知"
  };
}

export function getDeepSeaDefaultLevel(section: number): number {
  return section === 11 ? 60 : 50;
}

export function getDeepSeaDefaultState(section: number, level = getDeepSeaDefaultLevel(section)): DeepSeaCalculatorState {
  const boss = getDeepSeaBoss(section);
  const state: DeepSeaCalculatorState = cloneState({
    ...baseState,
    section,
    level,
    boss
  });
  applyOverrides(state, specialStateBySection[section] ?? {});
  if (state.magicResistanceConfig.gugu24) {
    state.armorResistanceConfig.gugu24Level = true;
    state.armorResistanceConfig.guguCoreCount = state.magicResistanceConfig.coreCount;
  }
  if (state.trueDamageResistanceConfig.raySkin) {
    state.additionalDamageResistanceConfig.raySkin = true;
  }
  applyEquipmentStats(state);
  return state;
}

export function calculateDeepSeaBoss(input: DeepSeaCalculationInput): DeepSeaCalculationResult {
  const levelOptions = deepSeaLevelOptions[input.section] ?? [];
  const level = levelOptions.includes(input.level) ? input.level : levelOptions[0] ?? input.level;
  const state = getDeepSeaDefaultState(input.section, level);
  applyOverrides(state, input.overrides ?? {});
  applyEquipmentStats(state);

  const bossCalculationData = getDeepSeaBossCalculationData(state);
  if (!input.overrides?.damageResistanceConfig?.damageResistanceChariot) {
    state.damageResistanceConfig.damageResistanceChariot = 90 + bossCalculationData.damageBonus;
  }
  const calculatorData = { ...defaultCalculatorData };
  const calculatedTotalHealth = calculateTotalHealth(state);
  calculateElementResistance(state, bossCalculationData, calculatorData);
  calculateTrueDamageResistance(state, bossCalculationData, calculatorData);
  calculateHealthPercentResistance(state, calculatorData);
  calculateDamageResistance(state, bossCalculationData, calculatorData);
  calculateAdditionalDamageResistance(state, bossCalculationData, calculatorData);
  calculateAttackReduction(state, bossCalculationData, calculatorData);
  calculateMagicResistance(state, bossCalculationData, calculatorData);
  calculateArmorResistance(state, bossCalculationData, calculatorData);
  calculatePureResistance(state, bossCalculationData, calculatorData);

  return buildDeepSeaDamageResult({
    state,
    levelOptions,
    bossCalculationData,
    calculatorData,
    calculatedTotalHealth
  });
}

function blankDamageResistanceConfig(): Partial<DeepSeaDamageResistanceConfig> {
  return {
    damageResistance: 0,
    chiefLevel: 0,
    chiefSkin: false,
    chiefSkinType: 0,
    wildLevel: 0,
    guguDamageReductionSkin: false,
    coreCount: 0,
    wukongSummon: 0,
    wukongLevel: 0
  };
}

function defaultRayAttackReduction(): Partial<DeepSeaAttackReductionConfig> {
  return {
    wukongEnabled: false,
    wukongLevel: 0,
    wukongSummon3: false,
    wukongSummon5: false,
    rayEnabled: true,
    rayLevel: 18
  };
}

function redEquipment(typeIndex: number, typeName: string): Partial<DeepSeaSelectedEquipment> {
  return { isRed: true, typeIndex, typeName };
}

function cloneState(state: DeepSeaCalculatorState): DeepSeaCalculatorState {
  return {
    ...state,
    boss: { ...state.boss },
    selectedEquipment: { ...state.selectedEquipment },
    equipmentStats: { ...state.equipmentStats },
    healthConfig: { ...state.healthConfig },
    magicResistanceConfig: { ...state.magicResistanceConfig },
    armorResistanceConfig: { ...state.armorResistanceConfig },
    pureResistanceConfig: { ...state.pureResistanceConfig },
    trueDamageResistanceConfig: { ...state.trueDamageResistanceConfig },
    elementResistanceConfig: { ...state.elementResistanceConfig },
    craftsmanConfig: { ...state.craftsmanConfig },
    damageResistanceConfig: { ...state.damageResistanceConfig },
    additionalDamageResistanceConfig: { ...state.additionalDamageResistanceConfig },
    healthPercentResistanceConfig: { ...state.healthPercentResistanceConfig },
    attackReductionConfig: { ...state.attackReductionConfig }
  };
}

function applyOverrides(state: DeepSeaCalculatorState, overrides: DeepSeaCalculatorOverrides): void {
  if (overrides.selectedEquipment) Object.assign(state.selectedEquipment, overrides.selectedEquipment);
  if (overrides.healthConfig) Object.assign(state.healthConfig, overrides.healthConfig);
  if (overrides.magicResistanceConfig) Object.assign(state.magicResistanceConfig, overrides.magicResistanceConfig);
  if (overrides.armorResistanceConfig) Object.assign(state.armorResistanceConfig, overrides.armorResistanceConfig);
  if (overrides.pureResistanceConfig) Object.assign(state.pureResistanceConfig, overrides.pureResistanceConfig);
  if (overrides.trueDamageResistanceConfig) Object.assign(state.trueDamageResistanceConfig, overrides.trueDamageResistanceConfig);
  if (overrides.elementResistanceConfig) Object.assign(state.elementResistanceConfig, overrides.elementResistanceConfig);
  if (overrides.craftsmanConfig) Object.assign(state.craftsmanConfig, overrides.craftsmanConfig);
  if (overrides.damageResistanceConfig) Object.assign(state.damageResistanceConfig, overrides.damageResistanceConfig);
  if (overrides.additionalDamageResistanceConfig) {
    Object.assign(state.additionalDamageResistanceConfig, overrides.additionalDamageResistanceConfig);
  }
  if (overrides.healthPercentResistanceConfig) {
    Object.assign(state.healthPercentResistanceConfig, overrides.healthPercentResistanceConfig);
  }
  if (overrides.attackReductionConfig) Object.assign(state.attackReductionConfig, overrides.attackReductionConfig);
  if (typeof overrides.squadMemberCount === "number") state.squadMemberCount = overrides.squadMemberCount;
}

function applyEquipmentStats(state: DeepSeaCalculatorState): void {
  const stats: DeepSeaEquipmentStats = {
    healthPercent: 0,
    magicResistance: 0,
    magicResistancePercent: 0,
    armor: 0,
    armorPercent: 0,
    pureResistance: 0
  };
  if (state.selectedEquipment.typeIndex === 0) {
    stats.healthPercent = state.selectedEquipment.isRed ? 75 : 50;
    stats.pureResistance = 75;
  } else if (state.selectedEquipment.typeIndex === 1) {
    stats.magicResistance = 40;
    stats.magicResistancePercent = state.selectedEquipment.isRed ? 15 : 0;
  } else if (state.selectedEquipment.typeIndex === 2) {
    stats.armor = 40;
    stats.armorPercent = state.selectedEquipment.isRed ? 15 : 0;
  }
  state.equipmentStats = stats;
  state.magicResistanceConfig.magicResistance = state.selectedEquipment.typeIndex === 1 ? stats.magicResistance : 0;
  state.magicResistanceConfig.magicResistancePercent = state.selectedEquipment.typeIndex === 1 ? stats.magicResistancePercent : 0;
  state.armorResistanceConfig.armor = state.selectedEquipment.typeIndex === 2 ? stats.armor : 0;
  state.armorResistanceConfig.armorPercent = state.selectedEquipment.typeIndex === 2 ? stats.armorPercent : 0;
}

function toNumber(value: number | string | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionLevel(options: readonly string[], index: number): number {
  const option = options[index] ?? "0级";
  const parsed = Number.parseInt(option.replace("级", ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cap(value: number, max: number): number {
  return Math.min(value, max);
}

export function formatDeepSeaNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(2)}万`;
  return `${Math.round(value)}`;
}

function calculateTotalHealth(state: DeepSeaCalculatorState): number {
  const health = toNumber(state.healthConfig.mainHealth);
  const manualBonus = toNumber(state.healthConfig.healthBonus);
  const equipmentBonus = state.equipmentStats.healthPercent || 0;
  const chiefDemonizedBonus = state.healthConfig.chiefDemonized ? 25 : 0;
  const earthSpiritBonus = state.elementResistanceConfig.earthSpiritDemonized ? VALUES.earthSpiritDemonized : 0;
  const guguBonus = state.healthConfig.guguBloodSkin
    ? VALUES.guguBloodSkin * Math.max(0, Math.trunc(toNumber(state.healthConfig.coreCount)))
    : 0;

  let deathBonus = 0;
  if (state.healthConfig.notFullDeath) {
    const notFullLevel = optionLevel(deepSeaNotFullDeathLevelOptions, state.healthConfig.notFullDeathLevel);
    const key = notFullLevel === 1 ? 1 : notFullLevel === 4 ? 2 : notFullLevel === 16 ? 4 : 0;
    if (key) deathBonus += VALUES.deathLevels[key as keyof typeof VALUES.deathLevels].notFull;
  }

  const deathLevel = optionLevel(deepSeaDeathLevelOptions, state.healthConfig.deathLevel);
  const deathKey = deathLevel === 1 ? 1 : deathLevel === 8 ? 3 : deathLevel === 20 ? 5 : 0;
  if (deathKey) deathBonus += VALUES.deathLevels[deathKey as keyof typeof VALUES.deathLevels].full;
  if (state.healthConfig.deathDemonized) {
    deathBonus += VALUES.deathDemonized * Math.max(0, Math.trunc(toNumber(state.healthConfig.priestCount)));
  }
  if (state.healthConfig.deathSkinType === 1) deathBonus += VALUES.deathSkins[1].health;

  return health * (1 + (manualBonus + equipmentBonus + chiefDemonizedBonus + earthSpiritBonus + guguBonus + deathBonus) / 100);
}

function calculateDamageResistance(
  state: DeepSeaCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const config = state.damageResistanceConfig;
  const craftsman = state.craftsmanConfig;
  const guguSkinBonus = config.guguDamageReductionSkin ? VALUES.guguDamageReductionSkin * toNumber(config.coreCount) : 0;
  const wildBonus = config.wildLevel === 1 ? 60 : config.wildLevel === 2 ? 80 : config.wildLevel === 3 ? 90 : 0;
  const chiefBonus = config.chiefLevel === 1 ? 50 : config.chiefLevel === 2 ? 60 : config.chiefLevel === 3 ? 70 : config.chiefLevel === 4 ? 80 : 0;
  const chiefSkinBonus = config.chiefSkinType === 1 ? 10 : config.chiefSkinType === 2 ? 25 : 0;
  const total =
    toNumber(config.damageResistance) +
    toNumber(config.damageResistanceChariot) +
    guguSkinBonus +
    wildBonus +
    chiefBonus +
    chiefSkinBonus;

  let critRateReduction = 0;
  let critDamageReduction = 0;
  if (craftsman.craftsmanLevel === 1) critRateReduction += 70;
  if (craftsman.craftsmanLevel === 2) critRateReduction += 100;
  if (craftsman.craftsmanLevel === 3) {
    critRateReduction += 100;
    critDamageReduction += 200;
  }
  if (craftsman.craftsmanLevel === 4) {
    critRateReduction += 130;
    critDamageReduction += 200;
  }
  if (craftsman.craftsmanLevel === 5) {
    critRateReduction += 130;
    critDamageReduction += 700;
  }
  if (craftsman.notFullCraftsman) {
    critRateReduction += craftsman.notFullCraftsmanLevel === 0 ? 50 : 65;
  }
  if (craftsman.craftsmanDemonized) critRateReduction += 50;
  if (craftsman.craftsmanSkin) critRateReduction += 20;
  if (state.selectedEquipment.typeIndex === 1) critDamageReduction += 500;
  if (state.selectedEquipment.typeIndex === 2) critRateReduction += 50;

  const effectiveCritRate = Math.max(0, bossData.critDamage - critRateReduction);
  const effectiveCritDamage = effectiveCritRate > 0 ? Math.max(0, bossData.trueDamageBonus - critDamageReduction) : 0;

  calculatorData.damageReduction = total;
  calculatorData.effectiveDamageReduction = cap(total - bossData.damageBonus, 90);
  calculatorData.critReduction = critRateReduction;
  calculatorData.critDamageReduction = critDamageReduction;
  calculatorData.effectiveCritRate = effectiveCritRate;
  calculatorData.effectiveCritDamage = effectiveCritDamage;
}

function calculateMagicResistance(
  state: DeepSeaCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const config = state.magicResistanceConfig;
  let flat = toNumber(config.magicResistance) + toNumber(config.magicResistanceChariot);
  let percent = toNumber(config.magicResistancePercent);
  if (config.chief12Level) flat += 5;
  if (config.pinkDeath && VALUES.deathSkins[2].magicResistance) percent += VALUES.deathSkins[2].magicResistance;

  if (config.notFullSiren) {
    const level = optionLevel(deepSeaNotFullSirenLevelOptions, config.notFullSirenLevel);
    const key = level === 1 ? 1 : level === 4 ? 2 : level === 16 ? 3 : 0;
    if (key) flat += VALUES.sirenLevels[key as keyof typeof VALUES.sirenLevels].notFull;
  }
  const sirenLevel = optionLevel(deepSeaSirenLevelOptions, config.sirenLevel);
  const sirenKey = sirenLevel <= 0 ? 0 : sirenLevel <= 1 ? 1 : sirenLevel <= 8 ? 2 : sirenLevel <= 20 ? 3 : 4;
  if (sirenKey) {
    const values = VALUES.sirenLevels[sirenKey as keyof typeof VALUES.sirenLevels];
    flat += values.full;
    percent += "additional" in values ? values.additional ?? 0 : 0;
  }
  if (config.sirenDemonized) percent += VALUES.sirenDemonized;
  if (config.sirenSkin) percent += VALUES.sirenSkin;
  if (config.boneBow) {
    const level = optionLevel(deepSeaBoneBowLevelOptions, config.boneBowLevel);
    flat += VALUES.boneBowLevels[level as keyof typeof VALUES.boneBowLevels] ?? 0;
  }
  if (config.boneBowDemonized) percent += VALUES.boneBowDemonized;
  if (config.tentacleDoll) flat += VALUES.tentacleDoll;
  if (config.gugu24 || state.armorResistanceConfig.gugu24Level) {
    percent += 8 * toNumber(config.coreCount || state.armorResistanceConfig.guguCoreCount);
  }

  const value = flat * (1 + Math.max(percent - bossData.magicPenetrationPercent, -100) / 100) - bossData.magicPenetration;
  const reduction = resistanceValueToPercent(value);
  calculatorData.magicResistanceReduction = reduction;
  calculatorData.effectiveMagicResistance = reduction;
}

function calculateArmorResistance(
  state: DeepSeaCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const config = state.armorResistanceConfig;
  let flat = toNumber(config.armor) + toNumber(config.armorChariot);
  let percent = toNumber(config.armorPercent);
  if (state.magicResistanceConfig.chief12Level || config.chief12Level) flat += 5;
  if (config.pinkDeath && VALUES.deathSkins[2].armor) percent += VALUES.deathSkins[2].armor;
  if (config.steelManeDemonized) percent += VALUES.steelManeDemonized;
  if (config.steelManeSkinType === 1) flat += VALUES.steelManeSkin[1];
  if (config.steelManeSkinType === 2) percent += VALUES.steelManeSkin[2];

  const level = optionLevel(deepSeaSteelManeLevelOptions, config.steelManeLevel);
  const warriorCount = Math.max(1, Math.trunc(toNumber(config.warriorCount) || 1));
  if (level === 1) flat += VALUES.steelManeLevels[1].armor;
  else if (level === 8) flat += VALUES.steelManeLevels[3].armor;
  else if (level >= 12 && level < 20) flat += VALUES.steelManeLevels[3].armor + VALUES.steelManeLevels[4].armorPerWarrior * warriorCount;
  else if (level === 20) flat += VALUES.steelManeLevels[6].armor + VALUES.steelManeLevels[4].armorPerWarrior * warriorCount;
  else if (level === 24) {
    flat += VALUES.steelManeLevels[6].armor + VALUES.steelManeLevels[4].armorPerWarrior * warriorCount;
    percent += VALUES.steelManeLevels[7].armorPercent;
  }

  if (config.notFullSteelMane) {
    const notFullLevel = optionLevel(deepSeaNotFullSteelManeLevelOptions, config.notFullSteelManeLevel);
    if (notFullLevel === 1) flat += 15;
    if (notFullLevel === 4) flat += VALUES.steelManeLevels[2].armor;
    if (notFullLevel === 16) flat += VALUES.steelManeLevels[5].armor;
  }
  if (config.gugu24Level) percent += 8 * toNumber(config.guguCoreCount);

  const value = flat * (1 + Math.max(percent - bossData.armorPenetrationPercent, -100) / 100) - bossData.armorPenetration;
  const reduction = resistanceValueToPercent(value);
  calculatorData.armorReduction = reduction;
  calculatorData.effectiveArmorResistance = reduction;
}

function calculatePureResistance(
  state: DeepSeaCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const config = state.pureResistanceConfig;
  let total = toNumber(config.pureResistance) + toNumber(config.pureResistanceChariot) + state.equipmentStats.pureResistance;
  if (config.gugu24) total += 8 * toNumber(config.coreCount);
  if (config.tentacleDoll) total += VALUES.tentacleDoll;
  if (config.iceKnightLevel === 1) total += VALUES.iceKnightLevels[1];
  if (config.iceKnightLevel === 2) total += VALUES.iceKnightLevels[3];
  if (config.iceKnightLevel === 3) total += VALUES.iceKnightLevels[5];
  if (config.iceKnightLevel === 4) total += VALUES.iceKnightLevels[5] + VALUES.iceKnightLevels[6];
  if (config.iceKnightSkin) total += VALUES.iceKnightSkin;
  if (config.iceKnightDemonized) total += VALUES.iceKnightDemonized;
  if (config.notFullIceKnight) {
    if (config.notFullIceKnightLevel === 0) total += VALUES.notFullIceKnight;
    if (config.notFullIceKnightLevel === 1) total += VALUES.iceKnightLevels[2];
    if (config.notFullIceKnightLevel === 2) total += VALUES.iceKnightLevels[4];
  }

  calculatorData.pureReduction = total;
  calculatorData.effectivePureReduction = cap(total - (bossData.pureResistancePenetration || bossData.pureDamageBonus || 0), 90);
}

function calculateElementResistance(
  state: DeepSeaCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const config = state.elementResistanceConfig;
  let total = toNumber(config.elementResistancePercent);
  if (config.earthSpiritLevel === 1) total += VALUES.earthSpiritLevels[1];
  else if (config.earthSpiritLevel === 2) total += VALUES.earthSpiritLevels[3];
  else if (config.earthSpiritLevel === 3) total += VALUES.earthSpiritLevels[3] + 5 * toNumber(config.pandaCount);
  else if (config.earthSpiritLevel === 4) total += VALUES.earthSpiritLevels[6] + 5 * toNumber(config.pandaCount);
  else if (config.earthSpiritLevel === 5) total += VALUES.earthSpiritLevels[7] + 5 * toNumber(config.pandaCount);
  if (config.earthSpiritSkin) total += VALUES.earthSpiritSkin;
  if (config.zhiduoxing) total += 10;
  calculatorData.elementReduction = total;
  calculatorData.effectiveElementResistance = cap(total - bossData.elementDamageBonus, 90);
}

function calculateTrueDamageResistance(
  state: DeepSeaCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const config = state.trueDamageResistanceConfig;
  let total = toNumber(config.trueDamageResistance) + toNumber(config.trueDamageResistanceChariot);
  if (config.rayLevel === 1) total += 30;
  if (config.rayLevel === 2) total += 50;
  if (config.rayLevel === 3) total += 70;
  if (config.rayLevel === 4) total += 85;
  if (config.rayDemonized) total += VALUES.rayDemonized;
  if (config.raySkin) total += VALUES.raySkin;
  calculatorData.trueDamageReduction = total;
  calculatorData.effectiveTrueDamageResistance = cap(total - bossData.trueDamageBonus, 99);
}

function calculateAdditionalDamageResistance(
  state: DeepSeaCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const total = toNumber(state.additionalDamageResistanceConfig.airship) +
    (state.additionalDamageResistanceConfig.raySkin ? VALUES.raySkinAdditional : 0);
  calculatorData.additionalDamageReduction = total;
  calculatorData.effectiveAdditionalDamageResistance = cap(total - bossData.additionalDamageBonus, 90);
}

function calculateHealthPercentResistance(state: DeepSeaCalculatorState, calculatorData: DeepSeaCalculatorData): void {
  const config = state.healthPercentResistanceConfig;
  let total = toNumber(config.healthPercentResistance);
  if (config.submarineLevelIndex > 0) {
    total += VALUES.submarineLevels[config.submarineLevelIndex as keyof typeof VALUES.submarineLevels] ?? 0;
  }
  if (config.submarineDemonized) total += VALUES.submarineDemonized;
  if (config.submarineSkin) total += VALUES.submarineSkin;
  calculatorData.healthPercentReduction = cap(total, 99);
}

function calculateAttackReduction(
  state: DeepSeaCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const config = state.attackReductionConfig;
  let total = 0;
  if (config.wukongEnabled) {
    const summon = config.wukongSummon3 ? 3 : config.wukongSummon5 ? 5 : 0;
    const level = [0, 1, 4, 8, 20][config.wukongLevel] ?? 0;
    if (summon === 3 || summon === 5) {
      total += VALUES.wukong[summon][level as keyof (typeof VALUES.wukong)[typeof summon]] ?? 0;
    }
    if (config.wukongDemonized) total += 10;
  }
  if (config.rayEnabled) {
    if (config.rayLevel === 9) total += 10;
    if (config.rayLevel === 18) total += 20;
  }
  if (state.section === 3) {
    total -= (state.squadMemberCount || 5) * (bossData.attackReductionPerMember || 30);
  }
  calculatorData.attackReduction = total;
  calculatorData.effectiveAttackReduction = cap(total - bossData.attackBonus, 99);
}

function resistanceValueToPercent(value: number): number {
  if (value >= 0) return Math.min((0.052 * value) / (0.9 + 0.048 * value) * 100, 99);
  const abs = Math.abs(value);
  return -((0.052 * abs) / (0.9 + 0.048 * abs) * 100);
}

function getDeepSeaBossCalculationData(state: DeepSeaCalculatorState): DeepSeaBossCalculationData {
  const values = deepSeaAttackValues(state.section, state.level);
  let showMagicResistanceReduction = false;
  let showArmorReduction = false;
  let showPureReduction = false;
  let showElementReduction = true;
  let showTrueDamageReduction = false;
  let showAdditionalDamageReduction = false;
  let showHealthPercentReduction = false;

  if (state.section !== 7) {
    if (state.section === 1 || state.section === 9 || state.section === 6) {
      showMagicResistanceReduction = true;
      showElementReduction = false;
    } else if (state.section === 8) {
      showTrueDamageReduction = true;
      showElementReduction = false;
    } else if (state.section === 11) {
      showMagicResistanceReduction = true;
      showArmorReduction = true;
      showTrueDamageReduction = true;
      showAdditionalDamageReduction = true;
      showElementReduction = false;
    } else if (state.section === 2) {
      showPureReduction = true;
      showElementReduction = false;
    } else if (state.section === 10) {
      showPureReduction = true;
      showHealthPercentReduction = true;
      showElementReduction = false;
    } else if (state.section === 3) {
      showArmorReduction = true;
      showElementReduction = false;
    } else {
      showElementReduction = state.section === 4;
      showTrueDamageReduction = state.section === 5;
    }
  }

  return {
    ...values,
    attackType: state.boss.attackType,
    hasPercentDamage: values.percentDamageCoeff > 0,
    hasAdditionalDamage: values.additionalDamage > 0,
    showHealth: true,
    showDamageReduction: true,
    showAttackReduction: true,
    showMagicResistanceReduction,
    showArmorReduction,
    showPureReduction,
    showElementReduction,
    showTrueDamageReduction,
    showAdditionalDamageReduction,
    showHealthPercentReduction,
    showEquipment: true,
    showSquadMemberCount: state.section === 3
  };
}

function deepSeaAttackValues(section: number, level: number): Omit<
  DeepSeaBossCalculationData,
  | "attackType"
  | "hasPercentDamage"
  | "hasAdditionalDamage"
  | "showHealth"
  | "showDamageReduction"
  | "showAttackReduction"
  | "showMagicResistanceReduction"
  | "showArmorReduction"
  | "showPureReduction"
  | "showElementReduction"
  | "showTrueDamageReduction"
  | "showAdditionalDamageReduction"
  | "showHealthPercentReduction"
  | "showEquipment"
  | "showSquadMemberCount"
> {
  const base = {
    baseAttack: 0,
    attackBonus: 0,
    skillCoeff: 1,
    damageBonus: 0,
    critDamage: 0,
    percentDamageCoeff: 0,
    czMultiplier: 1,
    additionalDamage: 0,
    magicPenetrationPercent: 0,
    magicPenetration: 0,
    armorPenetrationPercent: 0,
    armorPenetration: 0,
    pureDamageBonus: 0,
    pureResistancePenetration: 0,
    elementDamageBonus: 0,
    trueDamageBonus: 0,
    additionalDamageBonus: 0,
    attackReductionPerMember: 0
  };

  const set = (values: Partial<typeof base>): typeof base => ({ ...base, ...values });
  if (section === 7) {
    if (level === 50) return set({ baseAttack: 184600000, attackBonus: 300 });
    if (level === 60) return set({ baseAttack: 246100000, attackBonus: 300, damageBonus: 30 });
    if (level === 70) return set({ baseAttack: 307000000, attackBonus: 300, damageBonus: 60 });
    if (level === 80) return set({ baseAttack: 316000000, attackBonus: 300, damageBonus: 90 });
    if (level === 90) return set({ baseAttack: 1105100000, attackBonus: 300, damageBonus: 120 });
    if (level === 100) return set({ baseAttack: 1420500000, attackBonus: 300, damageBonus: 150 });
  }
  if (section === 4) {
    if (level === 50) return set({ baseAttack: 184600000, attackBonus: 300 });
    if (level === 60) return set({ baseAttack: 246000000, attackBonus: 300, damageBonus: 30 });
    if (level === 70) return set({ baseAttack: 307000000, attackBonus: 300, damageBonus: 60 });
    if (level === 80) return set({ baseAttack: 316000000, attackBonus: 300, damageBonus: 90, trueDamageBonus: 10 });
    if (level === 90) return set({ baseAttack: 1105000000, attackBonus: 300, damageBonus: 120, trueDamageBonus: 10 });
    if (level === 100) return set({ baseAttack: 1420000000, attackBonus: 300, damageBonus: 150, trueDamageBonus: 10 });
  }

  const byLevel: Record<number, Record<number, Partial<typeof base>>> = {
    50: {
      1: { baseAttack: 175800000, attackBonus: 300, magicPenetrationPercent: 40, magicPenetration: 50 },
      9: { baseAttack: 175800000, attackBonus: 300, magicPenetrationPercent: 40, critDamage: 170, trueDamageBonus: 200 },
      8: { baseAttack: 51300000, attackBonus: 300 },
      6: { baseAttack: 175800000, attackBonus: 300, magicPenetrationPercent: 40 },
      2: { baseAttack: 322700000, attackBonus: 300, pureDamageBonus: 75 },
      10: { baseAttack: 461000000, attackBonus: 300, skillCoeff: 0.5, pureResistancePenetration: 75, percentDamageCoeff: 1250 },
      3: { baseAttack: 175800000, armorPenetrationPercent: 40, attackReductionPerMember: 30 }
    },
    60: {
      1: { baseAttack: 592775000, attackBonus: 300, damageBonus: 30, magicPenetrationPercent: 40, magicPenetration: 50 },
      9: { baseAttack: 594000000, attackBonus: 300, damageBonus: 30, magicPenetrationPercent: 40, critDamage: 180, trueDamageBonus: 400 },
      8: { baseAttack: 76800000, attackBonus: 300, damageBonus: 30 },
      6: { baseAttack: 592775000, attackBonus: 300, damageBonus: 30, magicPenetrationPercent: 40 },
      2: { baseAttack: 430500000, attackBonus: 300, damageBonus: 30, pureDamageBonus: 85 },
      10: { baseAttack: 615000000, attackBonus: 300, damageBonus: 30, skillCoeff: 0.5, pureResistancePenetration: 85, percentDamageCoeff: 1650 },
      11: { baseAttack: 154000000, attackBonus: 300, damageBonus: 30, armorPenetrationPercent: 40, magicPenetrationPercent: 40, pureResistancePenetration: 85 },
      3: { baseAttack: 594500000, damageBonus: 30, armorPenetrationPercent: 40, attackReductionPerMember: 30 }
    },
    70: {
      1: { baseAttack: 928000000, attackBonus: 300, damageBonus: 60, magicPenetrationPercent: 40, magicPenetration: 70 },
      9: { baseAttack: 928000000, attackBonus: 300, damageBonus: 60, magicPenetrationPercent: 40, critDamage: 200, trueDamageBonus: 400 },
      8: { baseAttack: 96000000, attackBonus: 300, damageBonus: 60 },
      6: { baseAttack: 928000000, attackBonus: 300, damageBonus: 60, magicPenetrationPercent: 40 },
      2: { baseAttack: 538300000, attackBonus: 300, damageBonus: 60, pureResistancePenetration: 85 },
      10: { baseAttack: 769000000, attackBonus: 300, damageBonus: 60, skillCoeff: 0.5, pureResistancePenetration: 85, percentDamageCoeff: 1650 },
      11: { baseAttack: 192000000, attackBonus: 300, damageBonus: 60, armorPenetrationPercent: 40, magicPenetrationPercent: 40, pureResistancePenetration: 85 },
      3: { baseAttack: 928000000, damageBonus: 60, armorPenetrationPercent: 40, attackReductionPerMember: 30 }
    },
    80: {
      1: { baseAttack: 1071064000, attackBonus: 300, damageBonus: 90, trueDamageBonus: 10, magicPenetrationPercent: 60, magicPenetration: 70 },
      9: { baseAttack: 1075500000, attackBonus: 300, damageBonus: 90, magicPenetrationPercent: 60, critDamage: 225, trueDamageBonus: 1000 },
      8: { baseAttack: 139000000, attackBonus: 300, damageBonus: 90, trueDamageBonus: 10 },
      6: { baseAttack: 1071064000, attackBonus: 300, damageBonus: 140, magicPenetrationPercent: 60 },
      2: { baseAttack: 663250000, attackBonus: 300, damageBonus: 90, pureDamageBonus: 95 },
      10: { baseAttack: 947450000, attackBonus: 300, damageBonus: 90, skillCoeff: 0.5, pureResistancePenetration: 95, percentDamageCoeff: 2500 },
      11: { baseAttack: 316000000, attackBonus: 300, damageBonus: 90, armorPenetrationPercent: 60, magicPenetrationPercent: 60, pureResistancePenetration: 95, trueDamageBonus: 10, additionalDamage: 20000000 },
      3: { baseAttack: 983450000, damageBonus: 90, armorPenetrationPercent: 60, attackReductionPerMember: 35 }
    },
    90: {
      1: { baseAttack: 1611759700, attackBonus: 300, damageBonus: 120, trueDamageBonus: 10, magicPenetrationPercent: 80, magicPenetration: 90 },
      9: { baseAttack: 1626000000, attackBonus: 300, damageBonus: 120, magicPenetrationPercent: 80, critDamage: 245, trueDamageBonus: 1000 },
      8: { baseAttack: 736500000, attackBonus: 300, damageBonus: 120, trueDamageBonus: 10 },
      6: { baseAttack: 1611759700, attackBonus: 300, damageBonus: 170, magicPenetrationPercent: 80 },
      2: { baseAttack: 773500000, attackBonus: 300, damageBonus: 120, pureDamageBonus: 105 },
      10: { baseAttack: 1105000000, attackBonus: 300, damageBonus: 120, skillCoeff: 0.5, pureResistancePenetration: 105, percentDamageCoeff: 2500 },
      11: { baseAttack: 737000000, attackBonus: 300, damageBonus: 120, armorPenetrationPercent: 80, magicPenetrationPercent: 80, pureResistancePenetration: 105, trueDamageBonus: 10, additionalDamage: 20000000 },
      3: { baseAttack: 1209327966, damageBonus: 120, armorPenetrationPercent: 80, attackReductionPerMember: 35 }
    },
    100: {
      1: { baseAttack: 2572925000, attackBonus: 300, damageBonus: 150, trueDamageBonus: 10, magicPenetrationPercent: 80, magicPenetration: 130 },
      9: { baseAttack: 2591000000, attackBonus: 300, damageBonus: 150, magicPenetrationPercent: 80, critDamage: 265, trueDamageBonus: 1000 },
      8: { baseAttack: 947000000, attackBonus: 300, damageBonus: 150, trueDamageBonus: 10 },
      6: { baseAttack: 2572925000, attackBonus: 300, damageBonus: 200, magicPenetrationPercent: 80 },
      2: { baseAttack: 945000000, attackBonus: 300, damageBonus: 150, pureDamageBonus: 125 },
      10: { baseAttack: 1350000000, attackBonus: 300, damageBonus: 150, skillCoeff: 0.5, pureResistancePenetration: 110, percentDamageCoeff: 2500 },
      11: { baseAttack: 947000000, attackBonus: 300, damageBonus: 150, armorPenetrationPercent: 80, magicPenetrationPercent: 80, pureResistancePenetration: 125, trueDamageBonus: 10, additionalDamage: 20000000 },
      3: { baseAttack: 2314195000, damageBonus: 150, armorPenetrationPercent: 80, attackReductionPerMember: 50 }
    },
    110: {
      2: { baseAttack: 1134000000, attackBonus: 300, damageBonus: 150, pureResistancePenetration: 125 },
      6: { baseAttack: 3055000000, attackBonus: 300, damageBonus: 200, magicPenetrationPercent: 140 },
      10: { baseAttack: 1518750000, attackBonus: 300, damageBonus: 150, skillCoeff: 0.5, pureResistancePenetration: 125, percentDamageCoeff: 4000 },
      11: { baseAttack: 1136000000, attackBonus: 300, damageBonus: 150, armorPenetrationPercent: 80, magicPenetrationPercent: 80, pureResistancePenetration: 125, trueDamageBonus: 10, additionalDamage: 20000000 }
    },
    120: {
      2: { baseAttack: 1181250000, attackBonus: 300, damageBonus: 150, pureResistancePenetration: 125 },
      11: { baseAttack: 1184000000, attackBonus: 300, damageBonus: 150, armorPenetrationPercent: 80, magicPenetrationPercent: 80, pureResistancePenetration: 125, trueDamageBonus: 10, additionalDamage: 20000000 }
    },
    130: {
      11: { baseAttack: 1231000000, attackBonus: 300, damageBonus: 150, armorPenetrationPercent: 80, magicPenetrationPercent: 80, pureResistancePenetration: 125, trueDamageBonus: 10, additionalDamage: 20000000 }
    }
  };

  return set(byLevel[level]?.[section] ?? {});
}

function buildDeepSeaDamageResult(input: {
  state: DeepSeaCalculatorState;
  levelOptions: readonly number[];
  bossCalculationData: DeepSeaBossCalculationData;
  calculatorData: DeepSeaCalculatorData;
  calculatedTotalHealth: number;
}): DeepSeaCalculationResult {
  const { state, bossCalculationData, calculatorData, calculatedTotalHealth } = input;
  const empty = {
    finalDamage: 0,
    formattedFinalDamage: "0",
    finalDamageSingle: 0,
    finalDamageTotal: 0,
    formattedSingleDamage: "",
    formattedTotalDamage: "",
    critDamage: 0,
    formattedCritDamage: "",
    trueDamage: null as number | null,
    physicalDamage: null as number | null,
    magicDamage: null as number | null,
    formattedTrueDamage: "",
    formattedPhysicalDamage: "",
    formattedMagicDamage: "",
    chainsawDamage: null as number | null,
    chainsawDamage4x: null as number | null,
    formattedChainsawDamage: "",
    formattedChainsawDamage4x: ""
  };
  const result = { ...empty };

  if (state.section === 4 && [80, 90, 100].includes(state.level)) {
    const base = calculateDefaultDamage({
      bossCalculationData,
      calculatorData,
      calculatedTotalHealth,
      attackType: bossCalculationData.attackType || state.boss.attackType
    });
    result.finalDamageSingle = Math.round(base.finalDamage * 0.3);
    result.finalDamageTotal = result.finalDamageSingle * 3;
    result.finalDamage = result.finalDamageTotal;
    result.formattedSingleDamage = formatDeepSeaNumber(result.finalDamageSingle);
    result.formattedTotalDamage = formatDeepSeaNumber(result.finalDamageTotal);
    result.formattedFinalDamage = result.formattedTotalDamage;
  } else if (state.section === 11) {
    const trueDamage = calculateDefaultDamage({
      bossCalculationData: { ...bossCalculationData, skillCoeff: 1 },
      calculatorData,
      calculatedTotalHealth,
      attackType: "真实伤害"
    }).finalDamage;
    const physicalDamage = calculateDefaultDamage({
      bossCalculationData: { ...bossCalculationData, skillCoeff: 2 },
      calculatorData,
      calculatedTotalHealth,
      attackType: "物理伤害"
    }).finalDamage;
    const magicDamage = calculateDefaultDamage({
      bossCalculationData: { ...bossCalculationData, skillCoeff: 2 },
      calculatorData,
      calculatedTotalHealth,
      attackType: "魔法伤害"
    }).finalDamage;
    result.trueDamage = Math.round(trueDamage);
    result.physicalDamage = Math.round(physicalDamage);
    result.magicDamage = Math.round(magicDamage);
    result.finalDamage = result.trueDamage + result.physicalDamage + result.magicDamage;
    result.formattedTrueDamage = formatDeepSeaNumber(result.trueDamage);
    result.formattedPhysicalDamage = formatDeepSeaNumber(result.physicalDamage);
    result.formattedMagicDamage = formatDeepSeaNumber(result.magicDamage);
    result.formattedFinalDamage = formatDeepSeaNumber(result.finalDamage);
  } else if (state.section === 2) {
    const finalDamage = Math.round(
      calculateDefaultDamage({
        bossCalculationData,
        calculatorData,
        calculatedTotalHealth,
        attackType: "纯粹伤害"
      }).finalDamage
    );
    result.finalDamage = finalDamage;
    result.formattedFinalDamage = formatDeepSeaNumber(finalDamage);
    result.chainsawDamage = Math.round(finalDamage * 0.5);
    result.chainsawDamage4x = result.chainsawDamage * 4;
    result.formattedChainsawDamage = formatDeepSeaNumber(result.chainsawDamage);
    result.formattedChainsawDamage4x = formatDeepSeaNumber(result.chainsawDamage4x);
  } else {
    const finalDamage = Math.round(
      calculateDefaultDamage({
        bossCalculationData,
        calculatorData,
        calculatedTotalHealth,
        attackType: bossCalculationData.attackType || state.boss.attackType
      }).finalDamage
    );
    result.finalDamage = finalDamage;
    result.formattedFinalDamage = formatDeepSeaNumber(finalDamage);
    if (state.section === 9 && calculatorData.effectiveCritRate > 0) {
      result.critDamage = Math.round(finalDamage * (2 + calculatorData.effectiveCritDamage / 100));
      result.formattedCritDamage = formatDeepSeaNumber(result.critDamage);
    }
  }

  return {
    boss: state.boss,
    level: state.level,
    levelOptions: input.levelOptions,
    state,
    bossCalculationData,
    calculatorData,
    calculatedTotalHealth,
    formattedTotalHealth: calculatedTotalHealth > 10000 ? (calculatedTotalHealth / 10000).toFixed(2) : calculatedTotalHealth.toFixed(0),
    ...result
  };
}

function calculateDefaultDamage(input: {
  bossCalculationData: DeepSeaBossCalculationData;
  calculatorData: DeepSeaCalculatorData;
  calculatedTotalHealth: number;
  attackType: string;
}): { finalDamage: number } {
  const { bossCalculationData, calculatorData, calculatedTotalHealth, attackType } = input;
  const baseDamage =
    bossCalculationData.baseAttack *
    (1 - calculatorData.effectiveAttackReduction / 100) *
    bossCalculationData.skillCoeff;
  let typedDamage = baseDamage * (1 - calculatorData.effectiveDamageReduction / 100);

  if (attackType === "元素攻击") typedDamage *= 1 - (calculatorData.effectiveElementResistance || 0) / 100;
  else if (attackType === "真实伤害") typedDamage *= 1 - (calculatorData.effectiveTrueDamageResistance || 0) / 100;
  else if (attackType === "魔法伤害" || attackType === "魔法攻击") {
    typedDamage *= 1 - (calculatorData.effectiveMagicResistance || 0) / 100;
  } else if (attackType === "纯粹伤害" || attackType === "纯粹攻击") {
    typedDamage *= 1 - (calculatorData.effectivePureReduction || 0) / 100;
  } else if (attackType === "物理伤害" || attackType === "物理攻击") {
    typedDamage *= 1 - (calculatorData.effectiveArmorResistance || 0) / 100;
  }

  let percentDamage =
    bossCalculationData.percentDamageCoeff / 100 * calculatedTotalHealth * (1 - calculatorData.healthPercentReduction / 100);
  if (attackType === "纯粹伤害" || attackType === "纯粹攻击") {
    percentDamage *= 1 - (calculatorData.effectivePureReduction || 0) / 100;
  }

  const finalDamage =
    typedDamage +
    bossCalculationData.additionalDamage * (1 - calculatorData.effectiveAdditionalDamageResistance / 100) +
    percentDamage;
  return { finalDamage: Math.max(Math.round(finalDamage), 0) };
}
