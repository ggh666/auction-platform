import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(import.meta.dirname, "DealFollowupPage.tsx");

describe("admin deal followup page", () => {
  it("does not expose buyer contact collection fields", () => {
    const page = readFileSync(pagePath, "utf8");

    expect(page).toContain("成交跟进");
    expect(page).toContain("主理人已联系");
    expect(page).not.toContain("买家联系方式");
    expect(page).not.toContain("buyerContact");
    expect(page).not.toContain("待买家补充");
    expect(page).not.toContain("微信号");
  });
});
