import { describe, expect, it } from "vitest";
import {
  calculateHealth,
  defaultHealthCalculatorConfig,
  healthCalculatorEquipmentOptions,
  healthCalculatorFullStarDeathOptions,
  healthCalculatorGreenStarDeathOptions,
  healthCalculatorPhantomSkinOptions
} from "./healthCalculator";

function noBonusConfig() {
  return {
    ...defaultHealthCalculatorConfig,
    equipment: "无",
    phantomSkin: "无",
    fullStarDeathLevel: "无",
    greenStarDeathLevel: "无",
    deathSkin: "无",
    deathDemonized: false,
    priestCount: 0,
    chiefDemonized: false,
    earthSpiritDemonized: false,
    guguBloodSkin: false,
    songJiangBondCount: 0,
    astrologyHealthPercent: 0,
    bloodChariotHealthPercent: 0
  } as const;
}

describe("health calculator", () => {
  it("matches the xiguaApp default health configuration from the guide screenshot", () => {
    const result = calculateHealth();

    expect(result.totalBaseHealth).toBe(11000000);
    expect(result.totalBonusPercent).toBe(370);
    expect(result.totalHealth).toBe(51700000);
    expect(result.formattedTotalHealth).toBe("5170.00万");
  });

  it("adds main and sub card health before applying bonuses", () => {
    expect(calculateHealth({ ...noBonusConfig(), mainCardHealth: 100, subCardHealth: 200 }).totalHealth).toBe(300);
    expect(calculateHealth({ ...noBonusConfig(), mainCardHealth: 100, subCardHealth: 200, equipment: "龙心" }).totalHealth).toBe(450);
  });

  it("exposes all selectable options needed by the miniapp page", () => {
    expect(healthCalculatorEquipmentOptions).toEqual(["无", "龙心", "烟斗", "强袭", "圣剑"]);
    expect(healthCalculatorPhantomSkinOptions).toEqual(["无", "紫金铃铛"]);
    expect(healthCalculatorFullStarDeathOptions).toEqual(["无", "8", "20"]);
    expect(healthCalculatorGreenStarDeathOptions).toEqual(["无", "4", "16"]);
  });

  it("calculates each health bonus source independently", () => {
    const base = noBonusConfig();

    expect(calculateHealth({ ...base, equipment: "龙心" }).totalBonusPercent).toBe(50);
    expect(calculateHealth({ ...base, equipment: "烟斗" }).totalBonusPercent).toBe(0);
    expect(calculateHealth({ ...base, equipment: "强袭" }).totalBonusPercent).toBe(0);
    expect(calculateHealth({ ...base, equipment: "圣剑" }).totalBonusPercent).toBe(0);
    expect(calculateHealth({ ...base, phantomSkin: "紫金铃铛" }).totalBonusPercent).toBe(25);
    expect(calculateHealth({ ...base, fullStarDeathLevel: "8" }).totalBonusPercent).toBe(120);
    expect(calculateHealth({ ...base, fullStarDeathLevel: "20" }).totalBonusPercent).toBe(150);
    expect(calculateHealth({ ...base, greenStarDeathLevel: "4" }).totalBonusPercent).toBe(40);
    expect(calculateHealth({ ...base, greenStarDeathLevel: "16" }).totalBonusPercent).toBe(50);
    expect(calculateHealth({ ...base, deathSkin: "万圣节死神" }).totalBonusPercent).toBe(25);
    expect(calculateHealth({ ...base, deathDemonized: true, priestCount: 3 }).totalBonusPercent).toBe(30);
    expect(calculateHealth({ ...base, chiefDemonized: true }).totalBonusPercent).toBe(25);
    expect(calculateHealth({ ...base, earthSpiritDemonized: true }).totalBonusPercent).toBe(20);
    expect(calculateHealth({ ...base, guguBloodSkin: true, songJiangBondCount: 3 }).totalBonusPercent).toBe(45);
    expect(calculateHealth({ ...base, astrologyHealthPercent: 12, bloodChariotHealthPercent: 8 }).totalBonusPercent).toBe(20);
  });

  it("falls back safely for empty, invalid, and negative numeric input", () => {
    const result = calculateHealth({
      ...noBonusConfig(),
      mainCardHealth: "",
      subCardHealth: "oops",
      priestCount: -3,
      songJiangBondCount: Number.NaN,
      astrologyHealthPercent: -20,
      bloodChariotHealthPercent: "bad"
    });

    expect(result.totalBaseHealth).toBe(0);
    expect(result.totalHealth).toBe(0);
    expect(result.formattedTotalHealth).toBe("0");
    expect(Number.isNaN(result.totalHealth)).toBe(false);
  });
});
