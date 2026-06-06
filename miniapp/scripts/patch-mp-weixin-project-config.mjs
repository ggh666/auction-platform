import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputProjectConfigPaths = [
  "dist/build/mp-weixin/project.config.json",
  "dist/dev/mp-weixin/project.config.json",
  "unpackage/dist/dev/mp-weixin/project.config.json"
];

let patched = 0;

for (const relativePath of outputProjectConfigPaths) {
  const outputProjectConfigPath = resolve(root, relativePath);

  if (!existsSync(outputProjectConfigPath)) {
    continue;
  }

  const projectConfig = JSON.parse(readFileSync(outputProjectConfigPath, "utf8"));
  projectConfig.miniprogramRoot = "";
  writeFileSync(outputProjectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);
  console.log(`[miniapp-build] patched ${relativePath} miniprogramRoot to empty string.`);
  patched += 1;
}

if (patched === 0) {
  console.warn("[miniapp-build] no generated mp-weixin project.config.json files found.");
}
