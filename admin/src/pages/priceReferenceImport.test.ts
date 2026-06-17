import { describe, expect, it } from "vitest";
import { parsePriceReferenceImportText } from "./priceReferenceImport";

describe("price reference import parser", () => {
  it("parses CSV rows and compact quality-profession rows into minimum prices", () => {
    const result = parsePriceReferenceImportText(`
职业,品质,低价
牧师,蓝色,30
金色牧师 300
术士，红色，900
`);

    expect(result.errors).toEqual([]);
    expect(result.entries).toEqual([
      { profession: "牧师", quality: "蓝", minPriceYuan: "30" },
      { profession: "牧师", quality: "金", minPriceYuan: "300" },
      { profession: "术士", quality: "红", minPriceYuan: "900" }
    ]);
  });

  it("reports invalid rows without returning partial entries", () => {
    const result = parsePriceReferenceImportText(`
战将,金色,300
牧师,蓝色,30.5
`);

    expect(result.entries).toEqual([]);
    expect(result.errors).toEqual([
      "第 2 行无法识别职业/品质：战将,金色,300",
      "第 3 行低价必须是正整数：牧师,蓝色,30.5"
    ]);
  });
});
