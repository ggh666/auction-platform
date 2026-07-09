import { describe, expect, it } from "vitest";
import {
  additionalCalculatorBoneBowSkinOptions,
  additionalCalculatorSirenLevelOptions,
  additionalCalculatorSirenSkinOptions,
  calculateAdditionalDamage,
  defaultAdditionalDamageCalculatorConfig
} from "./additionalCalculator";

function noBonusConfig() {
  return {
    ...defaultAdditionalDamageCalculatorConfig,
    sirenLevel: "无",
    sirenSkin: "无",
    sirenDemonized: false,
    guguDemonized: false,
    demonizedHeroCount: 0,
    boneBowSkin: "无",
    witchDoctorDemonized: false
  } as const;
}

describe("additional damage calculator", () => {
  it("matches the xiguaApp screenshot default additional damage configuration", () => {
    const result = calculateAdditionalDamage();

    expect(result.baseAdditionalDamage).toBe(600000);
    expect(result.totalBonusPercent).toBe(220);
    expect(result.totalAdditionalDamage).toBe(1920000);
    expect(result.formattedAdditionalDamage).toBe("192.0000万");
  });

  it("exposes all selectable options needed by the miniapp page", () => {
    expect(additionalCalculatorSirenLevelOptions).toEqual(["无", "9", "18"]);
    expect(additionalCalculatorSirenSkinOptions).toEqual(["无", "太平乐"]);
    expect(additionalCalculatorBoneBowSkinOptions).toEqual(["无", "文徵明"]);
  });

  it("calculates each additional damage bonus source independently", () => {
    const base = noBonusConfig();

    expect(calculateAdditionalDamage({ ...base, sirenLevel: "9" }).totalBonusPercent).toBe(50);
    expect(calculateAdditionalDamage({ ...base, sirenLevel: "18" }).totalBonusPercent).toBe(100);
    expect(calculateAdditionalDamage({ ...base, sirenSkin: "太平乐" }).totalBonusPercent).toBe(50);
    expect(calculateAdditionalDamage({ ...base, sirenDemonized: true }).totalBonusPercent).toBe(50);
    expect(calculateAdditionalDamage({ ...base, guguDemonized: true, demonizedHeroCount: 7 }).totalBonusPercent).toBe(70);
    expect(calculateAdditionalDamage({ ...base, guguDemonized: false, demonizedHeroCount: 7 }).totalBonusPercent).toBe(0);
    expect(calculateAdditionalDamage({ ...base, boneBowSkin: "文徵明" }).totalBonusPercent).toBe(30);
    expect(calculateAdditionalDamage({ ...base, witchDoctorDemonized: true }).totalBonusPercent).toBe(30);
  });

  it("applies all bonuses to the fixed additional damage base", () => {
    const result = calculateAdditionalDamage({
      ...noBonusConfig(),
      fixedAdditionalDamage: 100000,
      sirenLevel: "9",
      sirenSkin: "太平乐",
      boneBowSkin: "文徵明"
    });

    expect(result.totalBonusPercent).toBe(130);
    expect(result.totalAdditionalDamage).toBe(230000);
    expect(result.formattedAdditionalDamage).toBe("23.0000万");
  });

  it("falls back safely for empty, invalid, and negative numeric input", () => {
    const result = calculateAdditionalDamage({
      ...noBonusConfig(),
      fixedAdditionalDamage: "bad",
      demonizedHeroCount: -7
    });

    expect(result.baseAdditionalDamage).toBe(0);
    expect(result.totalBonusPercent).toBe(0);
    expect(result.totalAdditionalDamage).toBe(0);
    expect(result.formattedAdditionalDamage).toBe("0");
    expect(Number.isNaN(result.totalAdditionalDamage)).toBe(false);
  });
});
