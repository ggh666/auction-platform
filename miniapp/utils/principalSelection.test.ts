import { describe, expect, it } from "vitest";
import { normalizePrincipalSelection, requireSelectedPrincipalId } from "./principalSelection";

const principals = [
  { id: "1", displayName: "默认主理人" },
  { id: "2", displayName: "道具主理人" }
];

describe("miniapp principal selection", () => {
  it("does not auto-select the first principal when options load", () => {
    expect(normalizePrincipalSelection(principals, "")).toBe("");
  });

  it("keeps an explicit valid principal selection", () => {
    expect(normalizePrincipalSelection(principals, "2")).toBe("2");
    expect(requireSelectedPrincipalId(principals, "2")).toBe("2");
  });

  it("requires the selected principal to exist in the current options", () => {
    expect(normalizePrincipalSelection(principals, "999")).toBe("");
    expect(requireSelectedPrincipalId(principals, "999")).toBeNull();
  });
});
