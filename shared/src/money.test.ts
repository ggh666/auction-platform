import { describe, expect, it } from "vitest";
import { centsToYuanText, parseYuanToCents } from "./money";

describe("money helpers", () => {
  it("parses yuan text into integer cents", () => {
    expect(parseYuanToCents("12")).toBe(1200);
    expect(parseYuanToCents("12.3")).toBe(1230);
    expect(parseYuanToCents("12.34")).toBe(1234);
    expect(parseYuanToCents("0.01")).toBe(1);
  });

  it("trims whitespace before parsing yuan text", () => {
    expect(parseYuanToCents(" 12.34 ")).toBe(1234);
  });

  it("rejects invalid money input", () => {
    expect(() => parseYuanToCents("")).toThrow("Invalid amount");
    expect(() => parseYuanToCents("1.234")).toThrow("Invalid amount");
    expect(() => parseYuanToCents("-1")).toThrow("Invalid amount");
    expect(() => parseYuanToCents("999999999999999999999999.99")).toThrow("Invalid amount");
  });

  it("formats cents for display", () => {
    expect(centsToYuanText(0)).toBe("0.00");
    expect(centsToYuanText(1234)).toBe("12.34");
  });

  it("rejects invalid cent totals when formatting", () => {
    expect(() => centsToYuanText(-1)).toThrow("Invalid amount");
    expect(() => centsToYuanText(1.5)).toThrow("Invalid amount");
    expect(() => centsToYuanText(Number.MAX_SAFE_INTEGER + 1)).toThrow("Invalid amount");
  });
});
