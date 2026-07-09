import { describe, expect, it } from "vitest";
import { calculateCardUpgrade, cardUpgradeTypeOptions } from "./cardUpgrade";

describe("card upgrade calculator", () => {
  it("matches the xiguaApp default gold card upgrade configuration", () => {
    const result = calculateCardUpgrade();

    expect(result.cardTypeName).toBe("金卡");
    expect(result.currentLevel).toBe(1);
    expect(result.targetLevel).toBe(24);
    expect(result.requiredCardCount).toBe(525);
    expect(result.devilFruitCount).toBe(70);
    expect(result.formattedRequiredCards).toBe("525 张");
    expect(result.formattedDevilFruit).toBe("70 恶魔果");
  });

  it("exposes all card types needed by the miniapp page", () => {
    expect(cardUpgradeTypeOptions).toEqual([
      { type: "gold", name: "金卡" },
      { type: "purple", name: "紫卡" },
      { type: "blue", name: "蓝卡" },
      { type: "green", name: "绿卡" }
    ]);
  });

  it("sums upgrade card costs for each card type", () => {
    expect(calculateCardUpgrade({ cardType: "gold", currentLevel: 1, targetLevel: 5 }).requiredCardCount).toBe(10);
    expect(calculateCardUpgrade({ cardType: "purple", currentLevel: 1, targetLevel: 4 }).requiredCardCount).toBe(13);
    expect(calculateCardUpgrade({ cardType: "blue", currentLevel: 1, targetLevel: 5 }).requiredCardCount).toBe(75);
    expect(calculateCardUpgrade({ cardType: "green", currentLevel: 1, targetLevel: 5 }).requiredCardCount).toBe(150);
  });

  it("subtracts owned card count without going below zero", () => {
    expect(calculateCardUpgrade({ cardType: "gold", currentLevel: 1, targetLevel: 5, currentCount: 3 }).requiredCardCount).toBe(7);
    expect(calculateCardUpgrade({ cardType: "gold", currentLevel: 1, targetLevel: 5, currentCount: 99 }).requiredCardCount).toBe(0);
  });

  it("calculates devil fruit only after level 20", () => {
    const result = calculateCardUpgrade({ cardType: "gold", currentLevel: 20, targetLevel: 25 });

    expect(result.requiredCardCount).toBe(350);
    expect(result.devilFruitCount).toBe(100);
  });

  it("falls back safely for reversed levels and invalid input", () => {
    expect(calculateCardUpgrade({ currentLevel: 10, targetLevel: 3 }).requiredCardCount).toBe(0);

    const fallback = calculateCardUpgrade({
      cardType: "bad" as never,
      currentLevel: "bad",
      targetLevel: "",
      currentCount: -8
    });

    expect(fallback.config.cardType).toBe("gold");
    expect(fallback.currentLevel).toBe(1);
    expect(fallback.targetLevel).toBe(24);
    expect(fallback.currentCount).toBe(0);
    expect(fallback.requiredCardCount).toBe(525);
    expect(Number.isNaN(fallback.requiredCardCount)).toBe(false);
    expect(Number.isNaN(fallback.devilFruitCount)).toBe(false);
  });
});
