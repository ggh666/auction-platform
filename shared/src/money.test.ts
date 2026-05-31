import { describe, expect, it } from "vitest";
import { centsToYuanText, isWholeYuanCents, parseYuanToCents } from "./money";

describe("money helpers", () => {
  it("parses yuan text into integer cents", () => {
    expect(parseYuanToCents("12")).toBe(1200);
  });

  it("trims whitespace before parsing yuan text", () => {
    expect(parseYuanToCents(" 12 ")).toBe(1200);
  });

  it("rejects invalid money input", () => {
    expect(() => parseYuanToCents("")).toThrow("Invalid amount");
    expect(() => parseYuanToCents("12.3")).toThrow("Invalid amount");
    expect(() => parseYuanToCents("12.34")).toThrow("Invalid amount");
    expect(() => parseYuanToCents("0.01")).toThrow("Invalid amount");
    expect(() => parseYuanToCents("1.234")).toThrow("Invalid amount");
    expect(() => parseYuanToCents("-1")).toThrow("Invalid amount");
    expect(() => parseYuanToCents("999999999999999999999999")).toThrow("Invalid amount");
  });

  it("formats cents as whole yuan text for display", () => {
    expect(centsToYuanText(0)).toBe("0");
    expect(centsToYuanText(1200)).toBe("12");
    expect(centsToYuanText(1234)).toBe("12");
  });

  it("detects cent totals that represent whole yuan amounts", () => {
    expect(isWholeYuanCents(0)).toBe(true);
    expect(isWholeYuanCents(1200)).toBe(true);
    expect(isWholeYuanCents(1234)).toBe(false);
    expect(isWholeYuanCents(-100)).toBe(false);
    expect(isWholeYuanCents(1.5)).toBe(false);
  });

  it("rejects invalid cent totals when formatting", () => {
    expect(() => centsToYuanText(-1)).toThrow("Invalid amount");
    expect(() => centsToYuanText(1.5)).toThrow("Invalid amount");
    expect(() => centsToYuanText(Number.MAX_SAFE_INTEGER + 1)).toThrow("Invalid amount");
  });
});
