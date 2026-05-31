#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptPath = fileURLToPath(import.meta.url);
const archiveCacheDir = join("node_modules", ".cache", "auction-native-deps");

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function packageJsonPath(packagePath) {
  return join(packagePath, "package.json");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function readRuntime() {
  return {
    platform: process.platform,
    arch: process.arch,
    musl: isMuslRuntime()
  };
}

function isMuslRuntime() {
  if (process.platform !== "linux") {
    return false;
  }
  const report = typeof process.report?.getReport === "function" ? process.report.getReport() : null;
  const glibcVersion = report?.header?.glibcVersionRuntime;
  return !glibcVersion;
}

export function nativePackageNameFor(tool, runtime) {
  const { platform, arch, musl = false } = runtime;

  if (tool === "esbuild") {
    if (platform === "darwin" && (arch === "x64" || arch === "arm64")) {
      return `@esbuild/darwin-${arch}`;
    }
    if (platform === "linux" && (arch === "x64" || arch === "arm64" || arch === "ia32" || arch === "arm")) {
      return `@esbuild/linux-${arch}`;
    }
    if (platform === "win32" && (arch === "x64" || arch === "arm64" || arch === "ia32")) {
      return `@esbuild/win32-${arch}`;
    }
    return null;
  }

  if (tool === "rollup") {
    if (platform === "darwin" && (arch === "x64" || arch === "arm64")) {
      return `@rollup/rollup-darwin-${arch}`;
    }
    if (platform === "linux" && (arch === "x64" || arch === "arm64")) {
      return `@rollup/rollup-linux-${arch}-${musl ? "musl" : "gnu"}`;
    }
    if (platform === "win32" && (arch === "x64" || arch === "arm64" || arch === "ia32")) {
      return `@rollup/rollup-win32-${arch}-msvc`;
    }
    return null;
  }

  return null;
}

function siblingNativePackagePath(toolPath, nativePackageName) {
  const nodeModulesDir = dirname(toolPath);
  return join(nodeModulesDir, nativePackageName);
}

export function discoverRequiredNativePackages(lockfile, runtime = readRuntime()) {
  const packages = lockfile.packages;
  if (!isRecord(packages)) {
    throw new Error("package-lock.json does not contain a packages object");
  }

  const required = [];
  const seen = new Set();
  for (const [toolPath, toolPackage] of Object.entries(packages)) {
    if (!isRecord(toolPackage)) {
      continue;
    }
    const tool =
      toolPath.endsWith("node_modules/esbuild") ? "esbuild" : toolPath.endsWith("node_modules/rollup") ? "rollup" : null;
    if (!tool) {
      continue;
    }

    const nativePackageName = nativePackageNameFor(tool, runtime);
    if (!nativePackageName || !isRecord(toolPackage.optionalDependencies)) {
      continue;
    }
    const expectedVersion = toolPackage.optionalDependencies[nativePackageName];
    if (typeof expectedVersion !== "string") {
      continue;
    }

    const targetPath = siblingNativePackagePath(toolPath, nativePackageName);
    const key = `${targetPath}@${expectedVersion}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    required.push({
      tool,
      toolPath,
      nativePackageName,
      expectedVersion,
      targetPath,
      lockEntry: packages[targetPath] ?? null
    });
  }
  return required;
}

async function installedPackageVersion(projectRoot, targetPath) {
  const jsonPath = join(projectRoot, packageJsonPath(targetPath));
  if (!existsSync(jsonPath)) {
    return null;
  }
  const json = await readJson(jsonPath);
  return typeof json.version === "string" ? json.version : null;
}

function assertLockEntry(dependency) {
  if (!isRecord(dependency.lockEntry)) {
    throw new Error(`Missing lockfile entry for ${dependency.targetPath}`);
  }
  const { resolved, integrity } = dependency.lockEntry;
  if (typeof resolved !== "string" || !resolved.startsWith("http")) {
    throw new Error(`Missing tarball URL for ${dependency.targetPath}`);
  }
  if (typeof integrity !== "string" || !integrity.includes("sha512-")) {
    throw new Error(`Missing sha512 integrity for ${dependency.targetPath}`);
  }
  return { resolved, integrity };
}

function assertIntegrity(buffer, integrity, targetPath) {
  const expected = integrity
    .split(/\s+/)
    .map((item) => item.trim())
    .find((item) => item.startsWith("sha512-"))
    ?.slice("sha512-".length);
  if (!expected) {
    throw new Error(`Missing sha512 integrity for ${targetPath}`);
  }
  const actual = createHash("sha512").update(buffer).digest("base64");
  if (actual !== expected) {
    throw new Error(`Integrity check failed for ${targetPath}`);
  }
}

async function downloadTarball(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${targetPath}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function extractTarball(archivePath, targetFsPath) {
  await rm(targetFsPath, { recursive: true, force: true });
  await mkdir(targetFsPath, { recursive: true });
  const result = spawnSync("tar", ["-xzf", archivePath, "-C", targetFsPath, "--strip-components=1"], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`Failed to extract ${archivePath}`);
  }
}

async function ensureNativeDependency(projectRoot, dependency, options) {
  const currentVersion = await installedPackageVersion(projectRoot, dependency.targetPath);
  if (currentVersion === dependency.expectedVersion) {
    return { status: "ok", dependency };
  }

  if (options.checkOnly) {
    return { status: "missing", dependency };
  }

  const { resolved, integrity } = assertLockEntry(dependency);
  const tarball = await downloadTarball(resolved, dependency.targetPath);
  assertIntegrity(tarball, integrity, dependency.targetPath);

  const cacheDir = join(projectRoot, archiveCacheDir);
  await mkdir(cacheDir, { recursive: true });
  const archivePath = join(cacheDir, `${dependency.nativePackageName.replace("/", "-")}-${dependency.expectedVersion}.tgz`);
  await writeFile(archivePath, tarball);
  await extractTarball(archivePath, join(projectRoot, dependency.targetPath));
  return { status: "installed", dependency };
}

export async function ensureNativeDeps(projectRoot = process.cwd(), options = {}) {
  if (process.env.AUCTION_SKIP_NATIVE_DEPS === "1") {
    return [];
  }

  const lockfile = await readJson(join(projectRoot, "package-lock.json"));
  const dependencies = discoverRequiredNativePackages(lockfile, options.runtime ?? readRuntime());
  const results = [];
  for (const dependency of dependencies) {
    results.push(await ensureNativeDependency(projectRoot, dependency, { checkOnly: options.checkOnly === true }));
  }
  return results;
}

function summarize(results) {
  const installed = results.filter((result) => result.status === "installed");
  const missing = results.filter((result) => result.status === "missing");
  if (installed.length > 0) {
    console.log(`[native-deps] installed ${installed.length} package(s): ${installed.map((item) => item.dependency.targetPath).join(", ")}`);
  }
  if (missing.length > 0) {
    console.error(`[native-deps] missing ${missing.length} package(s): ${missing.map((item) => item.dependency.targetPath).join(", ")}`);
  }
  if (installed.length === 0 && missing.length === 0) {
    console.log("[native-deps] current architecture packages are ready");
  }
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const results = await ensureNativeDeps(process.cwd(), { checkOnly });
  summarize(results);
  if (results.some((result) => result.status === "missing")) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === scriptPath) {
  main().catch((error) => {
    console.error(`[native-deps] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
