import { describe, expect, it } from "vitest";
import {
  calculateDeepSeaBoss,
  deepSeaBosses,
  deepSeaLevelOptions,
  deepSeaMapRows,
  getDeepSeaBoss,
  getDeepSeaDefaultState
} from "./deepSeaBattle";

describe("deep sea battle guide data", () => {
  it("defines the fixed 5x5 deep sea map and clickable sections", () => {
    expect(deepSeaMapRows).toHaveLength(5);
    expect(deepSeaMapRows.every((row) => row.length === 5)).toBe(true);

    expect(deepSeaMapRows[0].map((cell) => cell.name)).toEqual(["天灾", "魔鬼", "典狱长", "禁卫", "人类"]);
    expect(deepSeaMapRows[2].map((cell) => cell.name)).toEqual(["怪人", "西门·简", "王城", "东门·简", "怪人"]);
    expect(deepSeaMapRows.flat().filter((cell) => cell.type === "boss" || cell.type === "royal-city")).toHaveLength(21);
    expect(deepSeaMapRows.flat().find((cell) => cell.name === "王城")).toMatchObject({
      type: "royal-city",
      section: 11
    });
  });

  it("keeps section names and level options aligned with the source miniapp", () => {
    expect(deepSeaBosses.map((boss) => boss.name)).toEqual([
      "魔鬼",
      "典狱长",
      "禁卫",
      "乌贼",
      "异兽",
      "魅影",
      "公主",
      "刺豚",
      "怪人",
      "简",
      "王城"
    ]);
    expect(deepSeaLevelOptions[1]).toEqual([50, 60, 70, 80, 90, 100]);
    expect(deepSeaLevelOptions[2]).toEqual([50, 60, 70, 80, 90, 100, 110, 120]);
    expect(deepSeaLevelOptions[11]).toEqual([60, 70, 80, 90, 100, 110, 120, 130]);
    expect(getDeepSeaBoss(6)).toMatchObject({ name: "魅影", attackType: "魔法攻击" });
  });
});

describe("deep sea battle calculator", () => {
  it("applies point-specific defaults for magic, armor, and royal city sections", () => {
    expect(getDeepSeaDefaultState(1).magicResistanceConfig).toMatchObject({
      magicResistanceChariot: 57,
      sirenLevel: 3,
      sirenDemonized: true,
      sirenSkin: true,
      coreCount: 5,
      boneBow: true,
      tentacleDoll: true
    });
    expect(getDeepSeaDefaultState(3)).toMatchObject({
      selectedEquipment: { isRed: true, typeIndex: 2, typeName: "强袭" },
      squadMemberCount: 12
    });
    expect(getDeepSeaDefaultState(11)).toMatchObject({
      selectedEquipment: { isRed: true, typeIndex: 1, typeName: "烟斗" },
      additionalDamageResistanceConfig: { airship: 50, raySkin: true }
    });
  });

  it("calculates default damage for representative deep sea sections", () => {
    expect(calculateDeepSeaBoss({ section: 1, level: 50 }).formattedFinalDamage).toBe("66.80万");
    expect(calculateDeepSeaBoss({ section: 2, level: 100 })).toMatchObject({
      formattedFinalDamage: "3591.00万",
      formattedChainsawDamage: "1795.50万",
      formattedChainsawDamage4x: "7182.00万"
    });
    expect(calculateDeepSeaBoss({ section: 4, level: 80 })).toMatchObject({
      formattedSingleDamage: "758.40万",
      formattedTotalDamage: "2275.20万"
    });
    expect(calculateDeepSeaBoss({ section: 11, level: 60 })).toMatchObject({
      formattedTrueDamage: "292.60万",
      formattedPhysicalDamage: "297.69万",
      formattedMagicDamage: "334.52万",
      formattedFinalDamage: "924.81万"
    });
  });

  it("handles invalid and adjustable inputs without producing negative final damage", () => {
    expect(calculateDeepSeaBoss({ section: 999, level: 999 }).formattedFinalDamage).toBe("0");
    expect(calculateDeepSeaBoss({ section: 11, level: 80 }).finalDamage).toBeLessThan(100000000);
    expect(
      calculateDeepSeaBoss({
        section: 3,
        level: 100,
        overrides: {
          squadMemberCount: 14,
          damageResistanceConfig: { damageResistanceChariot: 999 },
          healthConfig: { mainHealth: "" }
        }
      }).finalDamage
    ).toBeGreaterThanOrEqual(0);
  });
});
