import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const assetDetailPath = resolve(import.meta.dirname, "AssetDetailPage.tsx");

describe("admin asset deadline editing", () => {
  it("shows an editable deadline control on the asset detail page", () => {
    const page = readFileSync(assetDetailPath, "utf8");

    expect(page).toContain("修改截止时间");
    expect(page).toContain("end-time");
    expect(page).toContain("datetime-local");
    expect(page).toContain("deadlineForm");
  });
});
