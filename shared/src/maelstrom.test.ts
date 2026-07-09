import { describe, expect, it } from "vitest";
import {
  calculateMaelstromBoss,
  formatMaelstromNumber,
  getMaelstromBoss,
  getMaelstromDefaultState,
  maelstromSections
} from "./maelstrom";

describe("maelstrom guide data", () => {
  it("keeps all whirlpool sections and boss names aligned with xiguaApp", () => {
    expect(maelstromSections).toEqual([120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
    expect(maelstromSections.map((section) => getMaelstromBoss(section).name)).toEqual([
      "龙族·黑龙",
      "龙族·红龙",
      "深海·水母",
      "深海公主",
      "深海刺豚",
      "深海典狱长",
      "深海·王宫守卫",
      "深海科学家·雷神",
      "海军元帅·简",
      "深海·异兽",
      "深海·魔鬼",
      "深海·乌贼"
    ]);
  });

  it("exposes boss attributes and marks non-calculator sections as text-only", () => {
    expect(getMaelstromBoss(110)).toMatchObject({
      name: "龙族·红龙",
      attack: expect.stringContaining("纯粹伤害"),
      defense: expect.stringContaining("冰甲"),
      skill: expect.stringContaining("召唤6颗龙珠"),
      hasCalculator: true
    });
    expect(getMaelstromBoss(60)).toMatchObject({
      name: "深海·王宫守卫",
      skill: expect.stringContaining("6位密码"),
      hasCalculator: false
    });
  });
});

describe("maelstrom calculator", () => {
  it("uses xiguaApp default boss calculation values", () => {
    expect(getMaelstromDefaultState(50).bossCalculationData).toMatchObject({
      baseAttack: 1300000000,
      attackBonus: 300,
      damageBonus: 130,
      magicPenetrationPercent: 50
    });
    expect(getMaelstromDefaultState(70).bossCalculationData).toMatchObject({
      baseAttack: 760000000,
      damageBonus: 140,
      pureDamageBonus: 95
    });
    expect(getMaelstromDefaultState(120).bossCalculationData).toMatchObject({
      baseAttack: 120000000,
      damageBonus: 180,
      trueDamageBonus: 50
    });
  });

  it("calculates representative maelstrom damage results", () => {
    expect(calculateMaelstromBoss({ section: 40 })).toMatchObject({
      formattedFinalDamage: "96.00万",
      survivalHits: 16
    });
    expect(calculateMaelstromBoss({ section: 50 }).formattedFinalDamage).toBe("6.54亿");
    expect(calculateMaelstromBoss({ section: 70 })).toMatchObject({
      formattedFinalDamage: "8.75亿",
      formattedNormalAttackDamage: "8.75亿",
      formattedChainAttackDamage: "4.25亿"
    });
    expect(calculateMaelstromBoss({ section: 80 }).formattedFinalDamage).toBe("1.05亿");
    expect(calculateMaelstromBoss({ section: 110 }).formattedFinalDamage).toBe("12.97亿");
    expect(calculateMaelstromBoss({ section: 120 }).formattedFinalDamage).toBe("6840.00万");
  });

  it("handles text-only and invalid sections without fake damage", () => {
    expect(calculateMaelstromBoss({ section: 60 })).toMatchObject({
      hasCalculator: false,
      finalDamage: 0,
      formattedFinalDamage: "暂无公式"
    });
    expect(calculateMaelstromBoss({ section: 999 })).toMatchObject({
      hasCalculator: false,
      finalDamage: 0
    });
    expect(
      calculateMaelstromBoss({
        section: 50,
        overrides: {
          healthConfig: { mainHealth: "" },
          damageResistanceConfig: { damageResistanceChariot: 999 }
        }
      }).finalDamage
    ).toBeGreaterThanOrEqual(0);
  });

  it("formats large and small damage values consistently", () => {
    expect(formatMaelstromNumber(120000000)).toBe("1.20亿");
    expect(formatMaelstromNumber(88999)).toBe("8.90万");
    expect(formatMaelstromNumber(Number.NaN)).toBe("0");
  });
});
