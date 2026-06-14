import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const miniappRoot = resolve(import.meta.dirname, "..");

function readPage(path: string): string {
  return readFileSync(resolve(miniappRoot, path), "utf8");
}

describe("miniapp user asset publishing game selection", () => {
  it("uses a fixed game picker instead of an editable game name input", () => {
    const page = readPage("pages/auctions/publish.vue");

    expect(page).toContain(':range="gameOptions"');
    expect(page).toContain(":value=\"selectedGameIndex\"");
    expect(page).toContain("@change=\"onGameChange\"");
    expect(page).toContain("normalizeGameName");
    expect(page).not.toContain('v-model="form.gameName" class="input"');
    expect(page).not.toContain("decodeURIComponent(query.gameName)");
  });
});
