import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("miniapp build configuration", () => {
  it("injects the price change subscribe template id into the miniapp bundle", () => {
    const viteConfig = readFileSync(resolve(import.meta.dirname, "vite.config.js"), "utf8");

    expect(viteConfig).toContain("UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID");
    expect(viteConfig).toContain("__PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__");
    expect(viteConfig).not.toContain("UNI_APP_DEAL_CONTACT_SUBSCRIBE_TEMPLATE_ID");
    expect(viteConfig).not.toContain("__DEAL_CONTACT_SUBSCRIBE_TEMPLATE_ID__");
  });

  it("points root WeChat DevTools imports at the built mini program output", () => {
    const projectConfig = JSON.parse(readFileSync(resolve(import.meta.dirname, "project.config.json"), "utf8")) as {
      miniprogramRoot?: string;
    };

    expect(projectConfig.miniprogramRoot).toBe("dist/build/mp-weixin/");
  });

  it("clears miniprogramRoot in generated WeChat DevTools configs", () => {
    const patchScript = readFileSync(
      resolve(import.meta.dirname, "scripts/patch-mp-weixin-project-config.mjs"),
      "utf8"
    );

    expect(patchScript).toContain("dist/build/mp-weixin/project.config.json");
    expect(patchScript).toContain("dist/dev/mp-weixin/project.config.json");
    expect(patchScript).toContain("unpackage/dist/dev/mp-weixin/project.config.json");
    expect(patchScript).toContain('projectConfig.miniprogramRoot = ""');
  });
});
