import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("miniapp build configuration", () => {
  it("injects the price change subscribe template id into the miniapp bundle", () => {
    const viteConfig = readFileSync(resolve(import.meta.dirname, "vite.config.js"), "utf8");

    expect(viteConfig).toContain("UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID");
    expect(viteConfig).toContain("__PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__");
    expect(viteConfig).toContain("UNI_APP_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID");
    expect(viteConfig).toContain("__REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID__");
    expect(viteConfig).toContain("wechatSubscribeTemplates.replyMessage.templateId");
    expect(viteConfig).not.toContain("1A5JXwLJfcDbZXHCQcQf7M8NA0GM4sfJ29CUFwFKUIc");
    expect(viteConfig).not.toContain("UNI_APP_DEAL_CONTACT_SUBSCRIBE_TEMPLATE_ID");
    expect(viteConfig).not.toContain("__DEAL_CONTACT_SUBSCRIBE_TEMPLATE_ID__");
  });

  it("uses the source root as the stable WeChat DevTools entry and wraps generated output", () => {
    const projectConfig = JSON.parse(readFileSync(resolve(import.meta.dirname, "project.config.json"), "utf8")) as {
      packOptions?: { ignore?: Array<{ type?: string; value?: string }> };
      miniprogramRoot?: string;
    };
    const rootAppJsonPath = resolve(import.meta.dirname, "app.json");
    const rootAppJsPath = resolve(import.meta.dirname, "app.js");
    const rootAppWxssPath = resolve(import.meta.dirname, "app.wxss");

    expect(projectConfig.miniprogramRoot).toBe("");
    expect(projectConfig.miniprogramRoot).not.toMatch(/^dist\//);
    expect(projectConfig.miniprogramRoot).not.toMatch(/^\./);
    expect(existsSync(rootAppJsonPath)).toBe(true);
    expect(existsSync(rootAppJsPath)).toBe(true);
    expect(existsSync(rootAppWxssPath)).toBe(true);

    const rootAppJson = JSON.parse(readFileSync(rootAppJsonPath, "utf8")) as {
      pages?: string[];
      tabBar?: { list?: Array<{ pagePath?: string; text?: string }> };
    };

    expect(rootAppJson.pages?.every((page) => page.startsWith("devtools/mp-weixin/pages/"))).toBe(true);
    expect(rootAppJson.tabBar?.list?.map((item) => item.pagePath)).toEqual([
      "devtools/mp-weixin/pages/games/index",
      "devtools/mp-weixin/pages/profile/index"
    ]);
    const rootAppJs = readFileSync(rootAppJsPath, "utf8");
    expect(rootAppJs).toContain("patchPageNavigationUrls");
    expect(rootAppJs).toContain('"/devtools/mp-weixin/pages/"');
    expect(rootAppJs).toContain('require("./devtools/mp-weixin/app.js")');
    expect(readFileSync(rootAppWxssPath, "utf8")).toContain('@import "devtools/mp-weixin/app.wxss";');
  });

  it("excludes stale build folders without excluding the active mini program root", () => {
    const projectConfig = JSON.parse(readFileSync(resolve(import.meta.dirname, "project.config.json"), "utf8")) as {
      packOptions?: { ignore?: Array<{ type?: string; value?: string }> };
      miniprogramRoot?: string;
    };
    const ignoredFolders = new Set(
      projectConfig.packOptions?.ignore
        ?.filter((entry) => entry.type === "folder")
        .map((entry) => entry.value)
    );

    expect(ignoredFolders).toEqual(
      new Set(["dist", ".devtools", "unpackage", "node_modules"])
    );
    expect(ignoredFolders.has("devtools")).toBe(false);
    expect(ignoredFolders.has("devtools/mp-weixin")).toBe(false);
    expect(projectConfig.miniprogramRoot).toBe("");
  });

  it("clears miniprogramRoot in generated WeChat DevTools configs and syncs the stable import output", () => {
    const patchScript = readFileSync(
      resolve(import.meta.dirname, "scripts/patch-mp-weixin-project-config.mjs"),
      "utf8"
    );
    const syncScript = readFileSync(
      resolve(import.meta.dirname, "scripts/sync-mp-weixin-devtools-output.mjs"),
      "utf8"
    );
    const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const devRunner = readFileSync(resolve(import.meta.dirname, "scripts/dev-mp-weixin.mjs"), "utf8");

    expect(patchScript).toContain("devtools/mp-weixin/project.config.json");
    expect(patchScript).toContain("dist/build/mp-weixin/project.config.json");
    expect(patchScript).toContain("dist/dev/mp-weixin/project.config.json");
    expect(patchScript).toContain("unpackage/dist/dev/mp-weixin/project.config.json");
    expect(patchScript).toContain('projectConfig.miniprogramRoot = ""');
    expect(patchScript).toContain("app.json");
    expect(patchScript).toContain("--allow-missing-app-json");
    expect(patchScript).toContain("--assert");
    expect(packageJson.scripts?.["build:mp-weixin"]).toContain("patch-mp-weixin-project-config.mjs --assert");
    expect(packageJson.scripts?.["build:mp-weixin"]).toContain("sync-mp-weixin-devtools-output.mjs --source dist/build/mp-weixin --assert");
    expect(packageJson.scripts?.["dev:mp-weixin"]).toBe("node scripts/dev-mp-weixin.mjs");
    expect(devRunner).toContain("patch-mp-weixin-project-config.mjs");
    expect(devRunner).toContain("sync-mp-weixin-devtools-output.mjs");
    expect(devRunner).toContain("dist/dev/mp-weixin");
    expect(devRunner).toContain("--allow-missing-app-json");
    expect(devRunner).toContain("--allow-missing");
    expect(devRunner).toContain("setInterval");
    expect(syncScript).toContain("devtools/mp-weixin");
    expect(syncScript).toContain("writeRootWrapper");
    expect(syncScript).toContain("outputRootPrefixFor");
    expect(syncScript).toContain('projectConfig.miniprogramRoot = ""');
    expect(syncScript).toContain("app.json");
  });

  it("clears generated miniprogramRoot before validating output app.json", () => {
    const patchScript = readFileSync(
      resolve(import.meta.dirname, "scripts/patch-mp-weixin-project-config.mjs"),
      "utf8"
    );

    const patchIndex = patchScript.indexOf('projectConfig.miniprogramRoot = ""');
    const appJsonIndex = patchScript.indexOf("app.json");

    expect(patchIndex).toBeGreaterThanOrEqual(0);
    expect(appJsonIndex).toBeGreaterThanOrEqual(0);
    expect(patchIndex).toBeLessThan(appJsonIndex);
  });

  it("documents the source miniapp directory as the WeChat DevTools import path", () => {
    const readme = readFileSync(resolve(import.meta.dirname, "../README.md"), "utf8");
    const deployGuide = readFileSync(resolve(import.meta.dirname, "../deploy/tencent-cloud.md"), "utf8");

    expect(readme).toContain("微信开发者工具请导入 `miniapp` 源码目录");
    expect(readme).toContain("根目录 `project.config.json` 使用空 `miniprogramRoot`");
    expect(readme).toContain("根目录 `app.json` 会包装 `devtools/mp-weixin/`");
    expect(deployGuide).toContain("/Users/shiran/work/harness/products/auction-platform/miniapp");
    expect(deployGuide).toContain("根目录 `project.config.json` 使用空 `miniprogramRoot`");
    expect(deployGuide).toContain("根目录 `app.json` 会包装 `devtools/mp-weixin/`");
    expect(deployGuide).toContain("项目目录选择源码目录");
    expect(readme).not.toContain("微信开发者工具建议导入 `miniapp/dist/build/mp-weixin`");
    expect(deployGuide).not.toContain("项目目录选择编译后的微信小程序产物");
  });

  it("documents reused reply message subscription configuration without a duplicate miniapp flow", () => {
    const subscriptionGuide = readFileSync(
      resolve(import.meta.dirname, "../docs/wechat-price-change-subscribe-message.md"),
      "utf8"
    );

    expect(subscriptionGuide).toContain("留言回复通知");
    expect(subscriptionGuide).toContain("复用 `requestAssetMessageSubscription()`");
    expect(subscriptionGuide).toContain("不新增独立订阅按钮");
    expect(subscriptionGuide).toContain("WECHAT_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID");
    expect(subscriptionGuide).toContain("UNI_APP_REPLY_MESSAGE_SUBSCRIBE_TEMPLATE_ID");
    expect(subscriptionGuide).toContain("thing1");
    expect(subscriptionGuide).toContain("name2");
    expect(subscriptionGuide).toContain("thing5");
    expect(subscriptionGuide).toContain("date4");
    expect(subscriptionGuide).toContain("pages/profile/asset-chat?conversationId=");
  });
});
