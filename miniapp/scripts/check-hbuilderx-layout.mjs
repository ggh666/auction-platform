import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const requiredRootFiles = [
  "App.vue",
  "main.ts",
  "manifest.json",
  "pages.json",
  "project.config.json",
  "shims-vue.d.ts"
];
const requiredRootDirs = ["pages", "api", "auth"];

const missing = [...requiredRootFiles, ...requiredRootDirs].filter(
  (item) => !existsSync(resolve(root, item))
);

const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
const projectConfig = JSON.parse(readFileSync(resolve(root, "project.config.json"), "utf8"));
const tsconfig = JSON.parse(readFileSync(resolve(root, "tsconfig.json"), "utf8"));
const esbuildPackagePath = resolve(root, "node_modules/esbuild/package.json");
const esbuildBinaryPath = resolve(root, "node_modules/@esbuild/darwin-x64/bin/esbuild");
const esbuildMainPath = resolve(root, "node_modules/esbuild/lib/main.js");
const issues = [];

if (missing.length > 0) {
  issues.push(`missing: ${missing.join(", ")}`);
}

if (manifest.vueVersion !== "3") {
  issues.push('manifest.json must set "vueVersion": "3" for HBuilderX Vue3/Vite builds');
}

if (tsconfig.compilerOptions?.noEmit === true) {
  issues.push('tsconfig.json must not set "compilerOptions.noEmit": true for HBuilderX ts-loader');
}

if (projectConfig.miniprogramRoot !== "dist/build/mp-weixin/") {
  issues.push('project.config.json must set "miniprogramRoot": "dist/build/mp-weixin/" for WeChat DevTools root imports');
}

const generatedConfigs = [
  "dist/build/mp-weixin/project.config.json",
  "dist/dev/mp-weixin/project.config.json",
  "unpackage/dist/dev/mp-weixin/project.config.json"
];

for (const generatedConfig of generatedConfigs) {
  const generatedConfigPath = resolve(root, generatedConfig);

  if (!existsSync(generatedConfigPath)) {
    continue;
  }

  const generatedProjectConfig = JSON.parse(readFileSync(generatedConfigPath, "utf8"));
  if (generatedProjectConfig.miniprogramRoot !== "") {
    issues.push(`${generatedConfig} must set "miniprogramRoot": "" for direct output imports`);
  }
}

const buildOutputRoot = resolve(root, "dist/build/mp-weixin");
if (existsSync(buildOutputRoot) && !existsSync(resolve(buildOutputRoot, "app.json"))) {
  issues.push("dist/build/mp-weixin exists but app.json is missing; run npm run build:mp-weixin --workspace @auction/miniapp");
}

if (existsSync(esbuildPackagePath) && existsSync(esbuildBinaryPath)) {
  const esbuildPackage = JSON.parse(readFileSync(esbuildPackagePath, "utf8"));
  const esbuildBinaryVersion = execFileSync(esbuildBinaryPath, ["--version"], {
    encoding: "utf8"
  }).trim();

  if (esbuildPackage.version !== esbuildBinaryVersion) {
    issues.push(
      `local esbuild host ${esbuildPackage.version} does not match binary ${esbuildBinaryVersion}`
    );
  }

  const esbuildMain = readFileSync(esbuildMainPath, "utf8");
  if (esbuildMain.includes("process.env.ESBUILD_BINARY_PATH || ESBUILD_BINARY_PATH")) {
    issues.push("local esbuild must be patched by running npm run postinstall");
  }
}

if (issues.length > 0) {
  console.error(`HBuilderX uni-app layout is not ready:\n- ${issues.join("\n- ")}`);
  process.exit(1);
}

console.log("HBuilderX uni-app layout is ready.");
