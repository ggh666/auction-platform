import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("miniapp build configuration", () => {
  it("injects the price change subscribe template id into the miniapp bundle", () => {
    const viteConfig = readFileSync(resolve(import.meta.dirname, "vite.config.js"), "utf8");

    expect(viteConfig).toContain("UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID");
    expect(viteConfig).toContain("__PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__");
  });

  it("keeps the source project root compatible with HBuilderX and WeChat DevTools", () => {
    const projectConfig = JSON.parse(readFileSync(resolve(import.meta.dirname, "project.config.json"), "utf8")) as {
      miniprogramRoot?: string;
    };

    expect(projectConfig.miniprogramRoot).toBe("");
  });
});
