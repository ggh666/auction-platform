import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputProjectConfigPath = resolve(root, "dist/build/mp-weixin/project.config.json");

if (!existsSync(outputProjectConfigPath)) {
  console.warn(`[miniapp-build] project.config.json not found at ${outputProjectConfigPath}`);
  process.exit(0);
}

const projectConfig = JSON.parse(readFileSync(outputProjectConfigPath, "utf8"));
projectConfig.miniprogramRoot = "";
writeFileSync(outputProjectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);
console.log("[miniapp-build] patched dist/build/mp-weixin/project.config.json miniprogramRoot to empty string.");
