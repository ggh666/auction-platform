import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const assertMode = process.argv.includes("--assert");
const allowMissingAppJson = process.argv.includes("--allow-missing-app-json");
const quiet = process.argv.includes("--quiet");
const outputProjectConfigPaths = [
  "devtools/mp-weixin/project.config.json",
  "dist/build/mp-weixin/project.config.json",
  "dist/dev/mp-weixin/project.config.json",
  "unpackage/dist/dev/mp-weixin/project.config.json"
];

let patched = 0;
let found = 0;
const issues = [];

for (const relativePath of outputProjectConfigPaths) {
  const outputProjectConfigPath = resolve(root, relativePath);

  if (!existsSync(outputProjectConfigPath)) {
    if (assertMode && relativePath === "dist/build/mp-weixin/project.config.json") {
      issues.push(`${relativePath} is missing; run npm run build:mp-weixin --workspace @auction/miniapp`);
    }
    continue;
  }
  found += 1;

  const projectConfig = JSON.parse(readFileSync(outputProjectConfigPath, "utf8"));
  if (projectConfig.miniprogramRoot !== "") {
    projectConfig.miniprogramRoot = "";
    writeFileSync(outputProjectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);
    if (!quiet) {
      console.log(`[miniapp-build] patched ${relativePath} miniprogramRoot to empty string.`);
    }
    patched += 1;
  }

  const outputRoot = dirname(outputProjectConfigPath);
  if (!existsSync(resolve(outputRoot, "app.json"))) {
    if (!allowMissingAppJson) {
      issues.push(`${relativePath} points at an output directory without app.json`);
    }
    continue;
  }

  const verifiedConfig = JSON.parse(readFileSync(outputProjectConfigPath, "utf8"));
  if (verifiedConfig.miniprogramRoot !== "") {
    issues.push(`${relativePath} must set "miniprogramRoot": "" for direct output imports`);
  }
}

if (issues.length > 0) {
  console.error(`[miniapp-build] mp-weixin project config check failed:\n- ${issues.join("\n- ")}`);
  process.exit(1);
}

if (found === 0 && !quiet) {
  console.warn("[miniapp-build] no generated mp-weixin project.config.json files found.");
} else if (patched === 0 && !quiet) {
  console.log("[miniapp-build] generated mp-weixin project.config.json files already use empty miniprogramRoot.");
}
