import type {
  DeepSeaAdditionalDamageResistanceConfig,
  DeepSeaAttackReductionConfig,
  DeepSeaBossCalculationData,
  DeepSeaCalculatorData,
  DeepSeaCalculatorOverrides,
  DeepSeaDamageResistanceConfig,
  DeepSeaEquipmentStats,
  DeepSeaHealthConfig,
  DeepSeaHealthPercentResistanceConfig,
  DeepSeaMagicResistanceConfig,
  DeepSeaPureResistanceConfig,
  DeepSeaSelectedEquipment,
  DeepSeaTrueDamageResistanceConfig
} from "./deepSeaBattle";
import { deepSeaEquipmentOptions } from "./deepSeaBattle";

export type MaelstromSection = 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120;

export type MaelstromBossInfo = {
  section: MaelstromSection | number;
  name: string;
  icon: string;
  desc: string;
  health: string;
  attack: string;
  defense: string;
  skill: string;
  hasCalculator: boolean;
};

export type MaelstromCalculatorState = {
  section: number;
  boss: MaelstromBossInfo;
  selectedEquipment: DeepSeaSelectedEquipment;
  equipmentStats: DeepSeaEquipmentStats;
  healthConfig: DeepSeaHealthConfig;
  magicResistanceConfig: DeepSeaMagicResistanceConfig;
  pureResistanceConfig: DeepSeaPureResistanceConfig;
  trueDamageResistanceConfig: DeepSeaTrueDamageResistanceConfig;
  damageResistanceConfig: DeepSeaDamageResistanceConfig;
  additionalDamageResistanceConfig: DeepSeaAdditionalDamageResistanceConfig;
  healthPercentResistanceConfig: DeepSeaHealthPercentResistanceConfig;
  attackReductionConfig: DeepSeaAttackReductionConfig;
  bossCalculationData: DeepSeaBossCalculationData;
};

export type MaelstromCalculationResult = {
  boss: MaelstromBossInfo;
  section: number;
  hasCalculator: boolean;
  state: MaelstromCalculatorState;
  bossCalculationData: DeepSeaBossCalculationData;
  calculatorData: DeepSeaCalculatorData;
  calculatedTotalHealth: number;
  formattedTotalHealth: string;
  finalDamage: number;
  formattedFinalDamage: string;
  normalAttackDamage: number | null;
  chainAttackDamage: number | null;
  formattedNormalAttackDamage: string;
  formattedChainAttackDamage: string;
  survivalHits: number | null;
};

export const maelstromSections = [120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10] as const;
export const maelstromEquipmentOptions = deepSeaEquipmentOptions;

const VALUES = {
  guguBloodSkin: 15,
  sirenDemonized: 20,
  sirenSkin: 20,
  boneBowDemonized: 10,
  tentacleDoll: 20,
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
    2: { magicResistance: 20 }
  },
  sirenLevels: {
    1: { notFull: 15, full: 35 },
    2: { notFull: 20, full: 45 },
    3: { notFull: 25, full: 60 },
    4: { notFull: 0, full: 60, additional: 50 }
  },
  boneBowLevels: { 4: 10, 16: 15 },
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

export const maelstromBosses: readonly MaelstromBossInfo[] = [
  {
    section: 10,
    name: "深海·乌贼",
    icon: "乌",
    desc: "大漩涡第10波BOSS",
    health: "???",
    attack: "???",
    defense: "???",
    skill: "战斗开始时喷涂墨汁（可用手指划过屏幕擦除墨迹，墨迹未完全擦除前，无法进行任何操作），靠近后对战车造成致命伤害",
    hasCalculator: false
  },
  {
    section: 20,
    name: "深海·魔鬼",
    icon: "魔",
    desc: "大漩涡第20波BOSS",
    health: "???",
    attack: "魔法伤害",
    defense: "???",
    skill: "深海·魔鬼对战车造成魔法伤害，战斗开始时攻速+900%",
    hasCalculator: false
  },
  {
    section: 30,
    name: "深海·异兽",
    icon: "异",
    desc: "大漩涡第30波BOSS",
    health: "???",
    attack: "???",
    defense: "???",
    skill: "异兽等待敌方喂食来满足食欲（可通过点击食物来进行投喂），当前想吃的菜品与敌方投喂的食物相同时，对自身造成20%生命上限伤害，否则进入狂暴状态，对战车造成致命伤害",
    hasCalculator: false
  },
  {
    section: 40,
    name: "海军元帅·简",
    icon: "简",
    desc: "大漩涡第40波BOSS",
    health: "???",
    attack: "生命上限百分比伤害",
    defense: "???",
    skill: "牢房内的封印使简处于冰封状态，尽快击碎冰块救出简，每秒对战车造成4%生命上限伤害，并附带禁疗效果",
    hasCalculator: true
  },
  {
    section: 50,
    name: "深海科学家·雷神",
    icon: "雷",
    desc: "大漩涡第50波BOSS",
    health: "???",
    attack: "魔法伤害，攻击+300%，伤害加成+130%，命中+999%",
    defense: "护甲+800，魔抗+800，护甲+60%，魔抗+60%，纯粹减免+150%，元素减免+90%，真实减免+130%，百分比减免+90%，伤害减免+150%，抗暴+125%，免疫减攻速、持续伤害、控制效果，冰甲:单次受到的伤害不超过最大生命值的0.008%，冰盾:受到伤害时，无敌0.02秒",
    skill: "阶段1:随机召唤封印着英雄的泡泡，战车前车人数大于后车时，泡泡向右移动，反之则泡泡向左移动，泡泡碰撞战车后，对战车造成致命伤害；正确的泡泡(鲛女、萨满)与自身碰撞后，将此泡泡内的英雄放入融合炉；错误的泡泡与自身碰进入狂暴状态，对战车造成致命伤害。\n阶段2：每2秒对战车造成100%攻击魔法伤害。\n被动1：阶段1期间自身无敌。\n被动2:敌方魔抗-50%，敌方攻击-150%，剧情对话结束90秒后狂暴，每次造成伤害时，额外造成目标1000%生命上限魔法伤害",
    hasCalculator: true
  },
  {
    section: 60,
    name: "深海·王宫守卫",
    icon: "卫",
    desc: "大漩涡第60波BOSS",
    health: "???",
    attack: "???",
    defense: "???",
    skill: "根据提示，输入正确的6位密码，否则触发防卫装置，对敌方造成致命伤害，若剧情结束60秒后仍未输入正确的密码，同样会触发防卫装置",
    hasCalculator: false
  },
  {
    section: 70,
    name: "深海典狱长",
    icon: "典",
    desc: "大漩涡第70波BOSS",
    health: "???",
    attack: "纯粹伤害，攻击+300%，伤害加成+140%，命中+999%",
    defense: "护甲+800，魔抗+800，护甲+60%，魔抗+60%，纯粹减免+150%，元素减免+90%，真实减免+130%，百分比减免+95%，伤害减免+150%，抗暴+125%，免疫减攻速、持续伤害、控制效果，冰甲:单次受到的伤害不超过最大生命值的0.004%，冰盾:受到伤害时，无敌0.02秒",
    skill: "技能：每秒对战车造成100%攻击纯粹伤害。\n阶段2:甩出链镣，攻击战车第二行，造成20%攻击纯粹伤害，若命中英雄，则本次伤害提高100倍。\n被动1：剧情对话期间自身无敌。\n被动2：敌方纯粹减免-95%。\n被动3：敌方攻击-150%。\n被动4：剧情对话结束90秒后狂暴。\n被动5：每次造成伤害时，额外造成目标1000%生命上限纯粹伤害",
    hasCalculator: true
  },
  {
    section: 80,
    name: "深海刺豚",
    icon: "刺",
    desc: "大漩涡第80波BOSS",
    health: "???",
    attack: "真实伤害，攻击+300%，伤害加成+150%，命中+999%，真实伤害加成+50%",
    defense: "护甲+850，魔抗+850，护甲+60%，魔抗+60%，纯粹减免+150%，元素减免+90%，真实减免+130%，百分比减免+96%，伤害减免+150%，抗暴+125%，免疫减攻速、持续伤害、控制效果，冰甲:单次受到的伤害不超过最大生命值的0.0032%，冰盾:受到伤害时，无敌0.02秒",
    skill: "技能1:对战车造成100%攻击真实伤害。\n技能2:召唤涡流化为水牢，随机禁锢一名敌方英雄，使其无法行动，持续30秒（点击水牢可解除禁锢）。\n被动1：剧情对话期间自身无敌。\n被动2:反弹40%伤害。\n被动3：敌方攻击-150%。\n被动4:剧情对话结束60秒后狂暴。\n被动5:每次造成伤害时，额外造成目标100%生命上限伤害",
    hasCalculator: true
  },
  {
    section: 90,
    name: "深海公主",
    icon: "公",
    desc: "大漩涡第90波BOSS",
    health: "???",
    attack: "真实伤害，攻击+300%，伤害加成+160%，命中+999%，真实伤害加成+30%",
    defense: "护甲+850，魔抗+850，护甲+60%，魔抗+60%，纯粹减免+150%，元素减免+90%，真实减免+130%，百分比减免+98%，伤害减免+150%，抗暴+125%，免疫减攻速、持续伤害、控制效果，冰甲:单次受到的伤害不超过最大生命值的0.002%，冰盾:受到伤害时，无敌0.02秒",
    skill: "阶段1:展示混乱的神龙拼图，点击拼图图片，将图案旋转至正确的方向；将神龙拼图恢复完整后，进入阶段2；若60秒后神龙拼图未恢复完整，则自身进入狂暴状态。\n阶段2:对战车造成100%攻击真实伤害。\n被动1：剧情对话期间自身无敌。\n被动2：敌方攻击-150%。\n被动3:阶段2开始60秒后狂暴",
    hasCalculator: true
  },
  {
    section: 100,
    name: "深海·水母",
    icon: "母",
    desc: "大漩涡第100波BOSS",
    health: "???",
    attack: "魔法伤害，攻击+300%，命中+999，伤害加成+170%",
    defense: "护甲+850，魔抗+850，护甲+50%，魔抗+60%，纯粹减免+150%，元素减免+90%，真实减免+136%，百分比减免+99%，伤害减免+150%，抗暴+125%，免疫减攻速、持续伤害、控制效果，冰甲：单次受到的伤害不超过最大生命值的0.001%，冰盾：受到伤害时，无敌0.02秒",
    skill: "技能1：对战车造成100%攻击魔法伤害。\n技能2：召唤海蜇，随机禁锢一名敌方英雄，使其无法行动，持续30秒（点击海蜇可解除禁锢）。\n每释放4次技能后，受到深海泰坦影响，进入魔化状态，期间伤害加成+9999%（神龙放射的龙炎可将那恶的泰坦之力净化）。\n被动1：剧情对话期间自身无敌。\n被动2：敌方攻击-150%。\n被动3：敌方魔抗-110%。\n被动4：敌方每次施放精灵时，回复自身生命上限2%的生命，不受减疗/禁疗影响。\n被动5：战斗开始90秒后狂暴",
    hasCalculator: true
  },
  {
    section: 110,
    name: "龙族·红龙",
    icon: "龙",
    desc: "大漩涡第110波BOSS",
    health: "???",
    attack: "纯粹伤害，命中+999%，攻击+300%，伤害加成+170%",
    defense: "护甲+850，魔抗+850，护甲+50%，魔抗+60%，纯粹减免+150%，元素减免+90%，真实减免+136%，百分比减免+99%，伤害减免+150%，抗暴+125%，免疫减(攻)速、持续伤害、控制效果，冰甲：单次受到的伤害不超过最大生命值的0.00125%，冰盾：受到伤害时，无敌0.02秒",
    skill: "阶段1：\n技能1：召唤6颗龙珠，龙珠共有7颗，分别为：龙珠·暗、龙珠·冰、龙珠·雷、龙珠·木、龙珠·魔、龙珠·幻、龙珠·光、龙珠·魂\n（左右滑动查看龙珠）\n代表的职业分别为： 战士 、 法师 、 猎人 、 牧师 、 术士 、 召唤 、 熊猫 、 工程 ，可通过点击龙珠使其切换为另一颗龙珠\n龙珠的排列对应前车的6处位置，当6颗龙珠代表的职业，与前车对应位置上所在英雄的职业保持一致时（以英雄本身基础职业为准，转职业和多职业的副职业无法通过判定），方可通过试炼进入阶段2\n阶段2：\n技能1：对敌方造成100%攻击纯粹伤害；\n技能2：施放暗精灵，使敌方英雄星级-1；\n被动：\n被动1：剧情对话期间自身无敌\n被动2：试炼开始90秒后狂暴\n被动3：敌方攻击-150%\n被动4：敌方纯粹防御-95%",
    hasCalculator: true
  },
  {
    section: 120,
    name: "龙族·黑龙",
    icon: "黑",
    desc: "大漩涡第120波BOSS",
    health: "???",
    attack: "真实伤害，命中+999%，攻击+300%，伤害加成+180%，真实伤害加成+50%",
    defense: "护甲+850，魔抗+850，护甲+50%，魔抗+60%，纯粹减免+150%，元素减免+90%，真实减免+135%，百分比减免+99%，伤害减免+150%，抗暴+125%，免疫减攻速、持续伤害、控制效果；\n冰甲：单次受到的伤害不超最大生命的0.000625%；\n冰盾：受到伤害时，无敌0.02秒",
    skill: "技能：对敌方造成100%攻击真实伤害\n被动1：战斗开始时召唤9颗龙珠，其中包含6颗龙珠·魔和3颗龙珠·木；\n剧情结束后，召唤魔雾将龙珠遮蔽，可通过点击驱散魔雾使龙珠激活；\n激活龙珠·魔对敌方持续造成致命伤害；\n激活龙珠·木使敌方回复100%生命上限生命，无视减疗/禁疗效果；\n每颗龙珠仅可激活一次\n被动2：剧情对话期间自身无敌\n被动3：剧情结束60秒后狂暴\n被动4：剧情结束后使敌方禁疗\n被动5：敌方攻击-150%",
    hasCalculator: true
  }
];

const baseState: Omit<MaelstromCalculatorState, "section" | "boss" | "bossCalculationData"> = {
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
    rayLevel: 18
  }
};

export function getMaelstromBoss(section: number): MaelstromBossInfo {
  return maelstromBosses.find((boss) => boss.section === section) ?? {
    section,
    name: `大漩涡BOSS ${Math.max(0, Math.trunc(section / 10))}`,
    icon: "涡",
    desc: `大漩涡第${section}关的BOSS`,
    health: "???",
    attack: "???",
    defense: "???",
    skill: "???",
    hasCalculator: false
  };
}

export function getMaelstromDefaultState(section: number): MaelstromCalculatorState {
  const boss = getMaelstromBoss(section);
  const state = cloneState({
    ...baseState,
    section,
    boss,
    bossCalculationData: maelstromBossCalculationData(section, boss)
  });
  applyEquipmentStats(state);
  state.bossCalculationData = maelstromBossCalculationData(section, boss);
  state.damageResistanceConfig.damageResistanceChariot = 90 + state.bossCalculationData.damageBonus;
  return state;
}

export function calculateMaelstromBoss(input: {
  section: number;
  overrides?: DeepSeaCalculatorOverrides;
}): MaelstromCalculationResult {
  const state = getMaelstromDefaultState(input.section);
  applyOverrides(state, input.overrides ?? {});
  applyEquipmentStats(state);
  const bossCalculationData = state.bossCalculationData;
  if (!input.overrides?.damageResistanceConfig?.damageResistanceChariot) {
    state.damageResistanceConfig.damageResistanceChariot = 90 + bossCalculationData.damageBonus;
  }

  const calculatorData = { ...defaultCalculatorData };
  const calculatedTotalHealth = calculateTotalHealth(state);
  calculateDamageResistance(state, bossCalculationData, calculatorData);
  calculateAttackReduction(state, bossCalculationData, calculatorData);
  calculateMagicResistance(state, bossCalculationData, calculatorData);
  calculatePureResistance(state, bossCalculationData, calculatorData);
  calculateTrueDamageResistance(state, bossCalculationData, calculatorData);
  calculateAdditionalDamageResistance(state, bossCalculationData, calculatorData);
  calculateHealthPercentResistance(state, calculatorData);

  return buildMaelstromDamageResult({
    state,
    bossCalculationData,
    calculatorData,
    calculatedTotalHealth
  });
}

export function formatMaelstromNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(2)}万`;
  return `${Math.round(value)}`;
}

function maelstromBossCalculationData(section: number, boss: MaelstromBossInfo): DeepSeaBossCalculationData {
  const base = {
    baseAttack: 0,
    attackBonus: 0,
    skillCoeff: 1,
    damageBonus: 0,
    critDamage: 125,
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
  const valuesBySection: Record<number, ReturnType<typeof set>> = {
    40: set({ skillCoeff: 0, percentDamageCoeff: 6 }),
    50: set({ baseAttack: 1300000000, attackBonus: 300, damageBonus: 130, magicPenetrationPercent: 50 }),
    70: set({ baseAttack: 760000000, attackBonus: 300, damageBonus: 140, pureDamageBonus: 95 }),
    80: set({ baseAttack: 142000000, attackBonus: 300, damageBonus: 150, percentDamageCoeff: 100, trueDamageBonus: 50 }),
    90: set({ baseAttack: 400000000, attackBonus: 300, damageBonus: 160, trueDamageBonus: 30 }),
    100: set({ baseAttack: 4500000000, attackBonus: 300, damageBonus: 170, magicPenetrationPercent: 110 }),
    110: set({ baseAttack: 1750000000, attackBonus: 300, damageBonus: 170, pureDamageBonus: 95 }),
    120: set({ baseAttack: 120000000, attackBonus: 300, damageBonus: 180, trueDamageBonus: 50 })
  };
  const values = valuesBySection[section] ?? set({});
  const flags = maelstromDisplayFlags(section, boss.hasCalculator);
  return {
    ...values,
    attackType: boss.attack,
    hasPercentDamage: values.percentDamageCoeff > 0,
    hasAdditionalDamage: values.additionalDamage > 0,
    attackReductionPerMember: 0,
    ...flags
  };
}

function maelstromDisplayFlags(section: number, hasCalculator: boolean) {
  const base = {
    showHealth: hasCalculator,
    showDamageReduction: hasCalculator,
    showAttackReduction: hasCalculator,
    showMagicResistanceReduction: false,
    showArmorReduction: false,
    showPureReduction: false,
    showElementReduction: false,
    showTrueDamageReduction: false,
    showAdditionalDamageReduction: false,
    showHealthPercentReduction: false,
    showEquipment: hasCalculator,
    showSquadMemberCount: false
  };
  if (!hasCalculator) return base;
  if (section === 40) return { ...base, showDamageReduction: false, showAttackReduction: false, showHealthPercentReduction: true };
  if (section === 50) return { ...base, showMagicResistanceReduction: true, showHealthPercentReduction: true };
  if (section === 70) return { ...base, showPureReduction: true, showHealthPercentReduction: true };
  if (section === 80) return { ...base, showTrueDamageReduction: true, showHealthPercentReduction: true };
  if (section === 90) return { ...base, showTrueDamageReduction: true };
  if (section === 100) return { ...base, showMagicResistanceReduction: true };
  if (section === 110) return { ...base, showPureReduction: true };
  if (section === 120) return { ...base, showTrueDamageReduction: true };
  return base;
}

function buildMaelstromDamageResult(input: {
  state: MaelstromCalculatorState;
  bossCalculationData: DeepSeaBossCalculationData;
  calculatorData: DeepSeaCalculatorData;
  calculatedTotalHealth: number;
}): MaelstromCalculationResult {
  const { state, bossCalculationData, calculatorData, calculatedTotalHealth } = input;
  let finalDamage = 0;
  let normalAttackDamage: number | null = null;
  let chainAttackDamage: number | null = null;
  let survivalHits: number | null = null;

  if (!state.boss.hasCalculator) {
    return {
      boss: state.boss,
      section: state.section,
      hasCalculator: false,
      state,
      bossCalculationData,
      calculatorData,
      calculatedTotalHealth,
      formattedTotalHealth: formatTotalHealth(calculatedTotalHealth),
      finalDamage: 0,
      formattedFinalDamage: "暂无公式",
      normalAttackDamage,
      chainAttackDamage,
      formattedNormalAttackDamage: "",
      formattedChainAttackDamage: "",
      survivalHits
    };
  }

  if (state.section === 40) {
    finalDamage = Math.max(
      calculatedTotalHealth * ((bossCalculationData.percentDamageCoeff || 6) / 100) *
        (1 - calculatorData.healthPercentReduction / 100),
      0
    );
    survivalHits = finalDamage > 0 ? Math.floor(calculatedTotalHealth / finalDamage) : 0;
  } else if (state.section === 70) {
    const pureReduction = calculatorData.effectivePureReduction || 0;
    const healthExtra = 10 * calculatedTotalHealth *
      (1 - calculatorData.healthPercentReduction / 100) *
      (1 - pureReduction / 100);
    normalAttackDamage = Math.max(
      bossCalculationData.baseAttack *
        (1 - calculatorData.effectiveAttackReduction / 100) *
        bossCalculationData.skillCoeff *
        (1 - pureReduction / 100) *
        (1 - calculatorData.effectiveDamageReduction / 100) +
        healthExtra,
      0
    );
    chainAttackDamage = Math.max(
      0.2 *
        bossCalculationData.baseAttack *
        (1 - calculatorData.effectiveAttackReduction / 100) *
        bossCalculationData.skillCoeff *
        (1 - pureReduction / 100) *
        (1 - calculatorData.effectiveDamageReduction / 100) +
        healthExtra,
      0
    );
    finalDamage = normalAttackDamage;
  } else if (state.section === 80) {
    const trueReduction = calculatorData.effectiveTrueDamageResistance || 0;
    finalDamage = Math.max(
      bossCalculationData.baseAttack *
        (1 - calculatorData.effectiveAttackReduction / 100) *
        bossCalculationData.skillCoeff *
        (1 - trueReduction / 100) *
        (1 - calculatorData.effectiveDamageReduction / 100) +
        calculatedTotalHealth *
          (bossCalculationData.percentDamageCoeff / 100) *
          (1 - calculatorData.healthPercentReduction / 100) *
          (1 - trueReduction / 100),
      0
    );
  } else if (state.section === 90 || state.section === 120) {
    const trueReduction = calculatorData.effectiveTrueDamageResistance || 0;
    finalDamage = Math.max(
      bossCalculationData.baseAttack *
        (1 - calculatorData.effectiveAttackReduction / 100) *
        bossCalculationData.skillCoeff *
        (1 - trueReduction / 100) *
        (1 - calculatorData.effectiveDamageReduction / 100),
      0
    );
  } else if (state.section === 110) {
    const pureReduction = calculatorData.effectivePureReduction || 0;
    finalDamage = Math.max(
      bossCalculationData.baseAttack *
        (1 - calculatorData.effectiveAttackReduction / 100) *
        bossCalculationData.skillCoeff *
        (1 - pureReduction / 100) *
        (1 - calculatorData.effectiveDamageReduction / 100),
      0
    );
  } else if (state.section === 100) {
    finalDamage = Math.max(
      bossCalculationData.baseAttack *
        (1 - calculatorData.effectiveAttackReduction / 100) *
        bossCalculationData.skillCoeff *
        (1 - calculatorData.magicResistanceReduction / 100) *
        (1 - calculatorData.effectiveDamageReduction / 100) +
        bossCalculationData.additionalDamage * (1 - calculatorData.effectiveAdditionalDamageResistance / 100),
      0
    );
  } else if (state.section === 50) {
    finalDamage = Math.max(
      bossCalculationData.baseAttack *
        (1 - calculatorData.effectiveAttackReduction / 100) *
        bossCalculationData.skillCoeff *
        (1 - calculatorData.magicResistanceReduction / 100) *
        (1 - calculatorData.effectiveDamageReduction / 100) +
        bossCalculationData.additionalDamage * (1 - calculatorData.effectiveAdditionalDamageResistance / 100) +
        10 *
          calculatedTotalHealth *
          (1 - calculatorData.healthPercentReduction / 100) *
          (1 - calculatorData.magicResistanceReduction / 100),
      0
    );
  }

  const roundedDamage = Math.round(finalDamage);
  return {
    boss: state.boss,
    section: state.section,
    hasCalculator: true,
    state,
    bossCalculationData,
    calculatorData,
    calculatedTotalHealth,
    formattedTotalHealth: formatTotalHealth(calculatedTotalHealth),
    finalDamage: roundedDamage,
    formattedFinalDamage: formatMaelstromNumber(roundedDamage),
    normalAttackDamage: normalAttackDamage === null ? null : Math.round(normalAttackDamage),
    chainAttackDamage: chainAttackDamage === null ? null : Math.round(chainAttackDamage),
    formattedNormalAttackDamage: normalAttackDamage === null ? "" : formatMaelstromNumber(Math.round(normalAttackDamage)),
    formattedChainAttackDamage: chainAttackDamage === null ? "" : formatMaelstromNumber(Math.round(chainAttackDamage)),
    survivalHits
  };
}

function cloneState(state: MaelstromCalculatorState): MaelstromCalculatorState {
  return {
    ...state,
    boss: { ...state.boss },
    selectedEquipment: { ...state.selectedEquipment },
    equipmentStats: { ...state.equipmentStats },
    healthConfig: { ...state.healthConfig },
    magicResistanceConfig: { ...state.magicResistanceConfig },
    pureResistanceConfig: { ...state.pureResistanceConfig },
    trueDamageResistanceConfig: { ...state.trueDamageResistanceConfig },
    damageResistanceConfig: { ...state.damageResistanceConfig },
    additionalDamageResistanceConfig: { ...state.additionalDamageResistanceConfig },
    healthPercentResistanceConfig: { ...state.healthPercentResistanceConfig },
    attackReductionConfig: { ...state.attackReductionConfig },
    bossCalculationData: { ...state.bossCalculationData }
  };
}

function applyOverrides(state: MaelstromCalculatorState, overrides: DeepSeaCalculatorOverrides): void {
  if (overrides.selectedEquipment) Object.assign(state.selectedEquipment, overrides.selectedEquipment);
  if (overrides.healthConfig) Object.assign(state.healthConfig, overrides.healthConfig);
  if (overrides.magicResistanceConfig) Object.assign(state.magicResistanceConfig, overrides.magicResistanceConfig);
  if (overrides.pureResistanceConfig) Object.assign(state.pureResistanceConfig, overrides.pureResistanceConfig);
  if (overrides.trueDamageResistanceConfig) Object.assign(state.trueDamageResistanceConfig, overrides.trueDamageResistanceConfig);
  if (overrides.damageResistanceConfig) Object.assign(state.damageResistanceConfig, overrides.damageResistanceConfig);
  if (overrides.additionalDamageResistanceConfig) {
    Object.assign(state.additionalDamageResistanceConfig, overrides.additionalDamageResistanceConfig);
  }
  if (overrides.healthPercentResistanceConfig) {
    Object.assign(state.healthPercentResistanceConfig, overrides.healthPercentResistanceConfig);
  }
  if (overrides.attackReductionConfig) Object.assign(state.attackReductionConfig, overrides.attackReductionConfig);
}

function applyEquipmentStats(state: MaelstromCalculatorState): void {
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
  }
  state.equipmentStats = stats;
  state.magicResistanceConfig.magicResistance = state.selectedEquipment.typeIndex === 1 ? stats.magicResistance : 0;
  state.magicResistanceConfig.magicResistancePercent = state.selectedEquipment.typeIndex === 1 ? stats.magicResistancePercent : 0;
}

function calculateTotalHealth(state: MaelstromCalculatorState): number {
  const health = toNumber(state.healthConfig.mainHealth);
  const manualBonus = toNumber(state.healthConfig.healthBonus);
  const equipmentBonus = state.equipmentStats.healthPercent || 0;
  const chiefDemonizedBonus = state.healthConfig.chiefDemonized ? 25 : 0;
  const guguBonus = state.healthConfig.guguBloodSkin
    ? VALUES.guguBloodSkin * Math.max(0, Math.trunc(toNumber(state.healthConfig.coreCount)))
    : 0;

  let deathBonus = 0;
  if (state.healthConfig.notFullDeath) {
    const level = [1, 4, 16][state.healthConfig.notFullDeathLevel] ?? 0;
    const key = level === 1 ? 1 : level === 4 ? 2 : level === 16 ? 4 : 0;
    if (key) deathBonus += VALUES.deathLevels[key as keyof typeof VALUES.deathLevels].notFull;
  }

  const deathLevel = [0, 1, 8, 20][state.healthConfig.deathLevel] ?? 0;
  const deathKey = deathLevel === 1 ? 1 : deathLevel === 8 ? 3 : deathLevel === 20 ? 5 : 0;
  if (deathKey) deathBonus += VALUES.deathLevels[deathKey as keyof typeof VALUES.deathLevels].full;
  if (state.healthConfig.deathDemonized) {
    deathBonus += VALUES.deathDemonized * Math.max(0, Math.trunc(toNumber(state.healthConfig.priestCount)));
  }
  if (state.healthConfig.deathSkinType === 1) deathBonus += VALUES.deathSkins[1].health;

  return health * (1 + (manualBonus + equipmentBonus + chiefDemonizedBonus + guguBonus + deathBonus) / 100);
}

function calculateDamageResistance(
  state: MaelstromCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const total = toNumber(state.damageResistanceConfig.damageResistance) +
    toNumber(state.damageResistanceConfig.damageResistanceChariot);
  calculatorData.damageReduction = total;
  calculatorData.effectiveDamageReduction = cap(total - bossData.damageBonus, 90);
}

function calculateMagicResistance(
  state: MaelstromCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const config = state.magicResistanceConfig;
  let flat = toNumber(config.magicResistance) + toNumber(config.magicResistanceChariot);
  let percent = toNumber(config.magicResistancePercent);
  if (config.pinkDeath && VALUES.deathSkins[2].magicResistance) percent += VALUES.deathSkins[2].magicResistance;
  if (config.sirenLevel === 1) flat += VALUES.sirenLevels[1].full;
  if (config.sirenLevel === 2) flat += VALUES.sirenLevels[2].full;
  if (config.sirenLevel === 3) flat += VALUES.sirenLevels[3].full;
  if (config.sirenLevel === 4) {
    flat += VALUES.sirenLevels[4].full;
    percent += VALUES.sirenLevels[4].additional;
  }
  if (config.sirenDemonized) percent += VALUES.sirenDemonized;
  if (config.sirenSkin) percent += VALUES.sirenSkin;
  if (config.boneBow) flat += VALUES.boneBowLevels[[4, 16][config.boneBowLevel] as keyof typeof VALUES.boneBowLevels] ?? 0;
  if (config.boneBowDemonized) percent += VALUES.boneBowDemonized;
  if (config.tentacleDoll) flat += VALUES.tentacleDoll;
  if (config.gugu24) percent += 8 * toNumber(config.coreCount);

  const value = flat * (1 + Math.max(percent - bossData.magicPenetrationPercent, -100) / 100) - bossData.magicPenetration;
  const reduction = resistanceValueToPercent(value);
  calculatorData.magicResistanceReduction = reduction;
  calculatorData.effectiveMagicResistance = reduction;
}

function calculatePureResistance(
  state: MaelstromCalculatorState,
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

function calculateTrueDamageResistance(
  state: MaelstromCalculatorState,
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
  state: MaelstromCalculatorState,
  bossData: DeepSeaBossCalculationData,
  calculatorData: DeepSeaCalculatorData
): void {
  const total = toNumber(state.additionalDamageResistanceConfig.airship) +
    (state.additionalDamageResistanceConfig.raySkin ? VALUES.raySkinAdditional : 0);
  calculatorData.additionalDamageReduction = total;
  calculatorData.effectiveAdditionalDamageResistance = cap(total - bossData.additionalDamageBonus, 90);
}

function calculateHealthPercentResistance(state: MaelstromCalculatorState, calculatorData: DeepSeaCalculatorData): void {
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
  state: MaelstromCalculatorState,
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
  calculatorData.attackReduction = total;
  calculatorData.effectiveAttackReduction = cap(total - bossData.attackBonus, 99);
}

function resistanceValueToPercent(value: number): number {
  if (value >= 0) return Math.min((0.052 * value) / (0.9 + 0.048 * value) * 100, 99);
  const abs = Math.abs(value);
  return -((0.052 * abs) / (0.9 + 0.048 * abs) * 100);
}

function toNumber(value: number | string | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function cap(value: number, max: number): number {
  return Math.min(value, max);
}

function formatTotalHealth(value: number): string {
  return value > 10000 ? (value / 10000).toFixed(2) : value.toFixed(0);
}
