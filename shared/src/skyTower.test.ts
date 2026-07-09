import { describe, expect, it } from "vitest";
import {
  getSkyTowerFloor,
  mergeSkyTowerFloorOverrides,
  parseSkyTowerConfigText,
  skyTowerFloorPages,
  skyTowerFloors,
  skyTowerRewards,
  skyTowerSections,
  SkyTowerConfigParseError
} from "./skyTower";

describe("sky tower guide data", () => {
  it("covers all 40 floors across four selector pages", () => {
    expect(skyTowerSections).toEqual([1, 2, 3, 4]);
    expect(skyTowerFloorPages).toEqual([
      { page: 1, label: "1-10层", floors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { page: 2, label: "11-20层", floors: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
      { page: 3, label: "21-30层", floors: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
      { page: 4, label: "31-40层", floors: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40] }
    ]);
    expect(skyTowerFloors).toHaveLength(40);
    expect(skyTowerFloors.map((floor) => floor.floor)).toEqual(Array.from({ length: 40 }, (_, index) => index + 1));
  });

  it("marks elite floors and keeps xiguaApp reward values", () => {
    expect(skyTowerRewards).toEqual([
      { range: "1-9层", desc: "普通关卡", amount: 4, highlight: false },
      { range: "10层", desc: "精英关卡", amount: 10, highlight: true },
      { range: "11-19层", desc: "普通关卡", amount: 6, highlight: false },
      { range: "20层", desc: "精英关卡", amount: 15, highlight: true },
      { range: "21-29层", desc: "普通关卡", amount: 8, highlight: false },
      { range: "30层", desc: "精英关卡", amount: 20, highlight: true },
      { range: "31-39层", desc: "普通关卡", amount: 10, highlight: false },
      { range: "40层", desc: "精英关卡", amount: 25, highlight: true }
    ]);
    expect(getSkyTowerFloor(10)).toMatchObject({
      floor: 10,
      type: "elite",
      rewardAmount: 10,
      rewardDesc: "精英关卡"
    });
    expect(getSkyTowerFloor(31)).toMatchObject({
      floor: 31,
      type: "normal",
      rewardAmount: 10,
      rewardDesc: "普通关卡"
    });
  });

  it("uses explicit placeholders for missing xiguaApp formation data and falls back safely", () => {
    expect(getSkyTowerFloor(1)).toMatchObject({
      floor: 1,
      formationSummary: "资料待补充",
      frontChariot: ["资料待补充"],
      backChariot: ["资料待补充"],
      heroSlots: [
        { position: "前车", name: "资料待补充", quality: "unknown" },
        { position: "后车", name: "资料待补充", quality: "unknown" }
      ],
      tactics: ["xiguaApp 当前源码未包含该层阵容明细，待后续补充真实数据。"]
    });
    expect(getSkyTowerFloor(0).floor).toBe(1);
    expect(getSkyTowerFloor(999).floor).toBe(40);
    expect(getSkyTowerFloor(Number.NaN).floor).toBe(1);
  });

  it("parses admin-maintained floor details and merges them over default placeholders", () => {
    const rawText = [
      "1|前车猴子后车咕咕，控制节奏|猴子、酋长|咕咕、萨满|前车1:猴子:orange;前车2:酋长:green;后车1:咕咕:yellow|先开猴子；注意沉默",
      "10|精英层手动处理|战士|法师|前车:战士:unknown|开局留控制"
    ].join("\n");

    const overrides = parseSkyTowerConfigText(rawText);
    const floors = mergeSkyTowerFloorOverrides(overrides);

    expect(overrides).toEqual([
      {
        floor: 1,
        formationSummary: "前车猴子后车咕咕，控制节奏",
        frontChariot: ["猴子", "酋长"],
        backChariot: ["咕咕", "萨满"],
        heroSlots: [
          { position: "前车1", name: "猴子", quality: "orange" },
          { position: "前车2", name: "酋长", quality: "green" },
          { position: "后车1", name: "咕咕", quality: "yellow" }
        ],
        tactics: ["先开猴子", "注意沉默"]
      },
      expect.objectContaining({ floor: 10, formationSummary: "精英层手动处理" })
    ]);
    expect(floors[0]).toMatchObject({
      floor: 1,
      formationSummary: "前车猴子后车咕咕，控制节奏",
      frontChariot: ["猴子", "酋长"],
      tactics: ["先开猴子", "注意沉默"]
    });
    expect(floors[1]).toMatchObject({ floor: 2, formationSummary: "资料待补充" });
  });

  it("ignores the optional admin text header row", () => {
    const rawText = [
      "楼层|阵容说明|左侧战车|右侧战车|英雄位|战术备注",
      "1|前车猴子后车咕咕，控制节奏|猴子|咕咕|左1:猴子:orange|先开猴子"
    ].join("\n");

    expect(parseSkyTowerConfigText(rawText)).toEqual([
      expect.objectContaining({
        floor: 1,
        formationSummary: "前车猴子后车咕咕，控制节奏"
      })
    ]);
    expect(parseSkyTowerConfigText("楼层|阵容说明|前车|后车|英雄位|战术备注\n1|阵容|前车|后车|前车1:英雄:green|备注")).toHaveLength(1);
  });

  it("rejects invalid admin text with line-level messages", () => {
    expect(() => parseSkyTowerConfigText("41|阵容|前车|后车|前车:英雄:green|备注")).toThrow(
      new SkyTowerConfigParseError("第 1 行楼层必须是 1-40")
    );
    expect(() => parseSkyTowerConfigText("1|阵容|前车|后车|前车:英雄:green|备注\n1|重复|前车|后车|前车:英雄:green|备注")).toThrow(
      new SkyTowerConfigParseError("第 2 行楼层重复")
    );
    expect(() => parseSkyTowerConfigText("1|阵容|前车|后车|前车:英雄:red|备注")).toThrow(
      new SkyTowerConfigParseError("第 1 行英雄品质必须是 yellow/green/orange/unknown")
    );
    expect(() => parseSkyTowerConfigText("1|阵容|前车")).toThrow(
      new SkyTowerConfigParseError("第 1 行必须使用「楼层|阵容说明|左侧战车|右侧战车|英雄位|战术备注」格式")
    );
  });
});
