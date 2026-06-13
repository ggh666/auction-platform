import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const assertMode = args.includes("--assert");
const allowMissing = args.includes("--allow-missing");
const quiet = args.includes("--quiet");

function readOption(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) {
    return fallback;
  }
  return args[index + 1] ?? fallback;
}

const sourceRelativePath = readOption("--source", "");
const destinationRelativePath = readOption("--destination", "devtools/mp-weixin");
const issues = [];

function outputRootPrefixFor(outputRootRelativePath) {
  return `${outputRootRelativePath.replace(/\/+$/, "")}/`;
}

function navigationPagePrefixFor(outputRootRelativePath) {
  return `/${outputRootPrefixFor(outputRootRelativePath)}pages/`;
}

function prefixedPagePath(outputRootPrefix, pagePath) {
  if (typeof pagePath !== "string" || pagePath.startsWith(outputRootPrefix)) {
    return pagePath;
  }
  return `${outputRootPrefix}${pagePath}`;
}

function rootAppJsFor(outputRootRelativePath) {
  const pagePrefix = navigationPagePrefixFor(outputRootRelativePath);
  return `const DEVTOOLS_WRAPPER_PAGE_PREFIX = "${pagePrefix}";

function prefixedMiniProgramUrl(url) {
  if (typeof url !== "string" || !url.startsWith("/pages/")) {
    return url;
  }
  return \`\${DEVTOOLS_WRAPPER_PAGE_PREFIX}\${url.slice("/pages/".length)}\`;
}

function patchPageNavigationUrls() {
  if (typeof wx !== "object" || wx === null) {
    return;
  }

  ["navigateTo", "redirectTo", "reLaunch", "switchTab"].forEach((apiName) => {
    const original = wx[apiName];
    if (typeof original !== "function" || original.__devtoolsWrapperPatched) {
      return;
    }

    function patchedNavigation(options) {
      if (options && typeof options === "object" && typeof options.url === "string") {
        return original.call(this, Object.assign({}, options, {
          url: prefixedMiniProgramUrl(options.url)
        }));
      }
      return original.apply(this, arguments);
    }

    patchedNavigation.__devtoolsWrapperPatched = true;
    wx[apiName] = patchedNavigation;
  });
}

patchPageNavigationUrls();
require("./${outputRootRelativePath.replace(/\/+$/, "")}/app.js");
`;
}

function writeRootWrapper(outputRootRelativePath, outputAppJson) {
  const outputRootPrefix = outputRootPrefixFor(outputRootRelativePath);
  const rootAppJson = JSON.parse(JSON.stringify(outputAppJson));

  rootAppJson.pages = Array.isArray(outputAppJson.pages)
    ? outputAppJson.pages.map((pagePath) => prefixedPagePath(outputRootPrefix, pagePath))
    : [];

  if (rootAppJson.tabBar?.list) {
    rootAppJson.tabBar.list = rootAppJson.tabBar.list.map((item) => ({
      ...item,
      pagePath: prefixedPagePath(outputRootPrefix, item.pagePath)
    }));
  }

  writeFileSync(resolve(root, "app.json"), `${JSON.stringify(rootAppJson, null, 2)}\n`);
  writeFileSync(resolve(root, "app.js"), rootAppJsFor(outputRootRelativePath));
  writeFileSync(resolve(root, "app.wxss"), `@import "${outputRootRelativePath.replace(/\/+$/, "")}/app.wxss";\n`);
  writeFileSync(resolve(root, "App.wxml"), "<slot/>\n");
}

if (!sourceRelativePath) {
  issues.push("--source is required");
}

const sourceRoot = resolve(root, sourceRelativePath);
const destinationRoot = resolve(root, destinationRelativePath);

if (issues.length === 0 && (!existsSync(sourceRoot) || !existsSync(resolve(sourceRoot, "app.json")))) {
  if (allowMissing) {
    process.exit(0);
  }
  issues.push(`${sourceRelativePath} is missing app.json`);
}

if (issues.length > 0) {
  const prefix = assertMode ? "[miniapp-build] mp-weixin devtools sync failed" : "[miniapp-build] mp-weixin devtools sync skipped";
  console.error(`${prefix}:\n- ${issues.join("\n- ")}`);
  process.exit(1);
}

const destinationParent = dirname(destinationRoot);
const temporaryRoot = resolve(destinationParent, `${basename(destinationRoot)}.tmp-${process.pid}`);
const backupRoot = resolve(destinationParent, `${basename(destinationRoot)}.backup-${process.pid}`);

rmSync(temporaryRoot, { recursive: true, force: true });
rmSync(backupRoot, { recursive: true, force: true });
mkdirSync(destinationParent, { recursive: true });
cpSync(sourceRoot, temporaryRoot, { recursive: true, force: true });

const projectConfigPath = resolve(temporaryRoot, "project.config.json");
if (existsSync(projectConfigPath)) {
  const projectConfig = JSON.parse(readFileSync(projectConfigPath, "utf8"));
  projectConfig.miniprogramRoot = "";
  writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);
}

if (!existsSync(resolve(temporaryRoot, "app.json"))) {
  rmSync(temporaryRoot, { recursive: true, force: true });
  console.error(`[miniapp-build] mp-weixin devtools sync failed:\n- ${sourceRelativePath} did not copy app.json`);
  process.exit(1);
}

try {
  if (existsSync(destinationRoot)) {
    renameSync(destinationRoot, backupRoot);
  }
  renameSync(temporaryRoot, destinationRoot);
  rmSync(backupRoot, { recursive: true, force: true });
} catch (error) {
  rmSync(temporaryRoot, { recursive: true, force: true });
  if (!existsSync(destinationRoot) && existsSync(backupRoot)) {
    renameSync(backupRoot, destinationRoot);
  }
  throw error;
}

writeRootWrapper(
  destinationRelativePath,
  JSON.parse(readFileSync(resolve(destinationRoot, "app.json"), "utf8"))
);

if (!quiet) {
  console.log(`[miniapp-build] synced ${sourceRelativePath} to ${destinationRelativePath} and refreshed root wrapper.`);
}
