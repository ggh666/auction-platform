import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const esbuildMain = resolve(import.meta.dirname, "../node_modules/esbuild/lib/main.js");
const original = 'var ESBUILD_BINARY_PATH = process.env.ESBUILD_BINARY_PATH || ESBUILD_BINARY_PATH;';
const patched =
  'var ESBUILD_BINARY_PATH = path.join(__dirname, "..", "bin", process.platform === "win32" ? "esbuild.exe" : "esbuild");';

const source = readFileSync(esbuildMain, "utf8");

if (source.includes(patched)) {
  console.log("Local esbuild binary path patch is already applied.");
} else if (source.includes(original)) {
  writeFileSync(esbuildMain, source.replace(original, patched));
  console.log("Local esbuild binary path patch applied.");
} else {
  throw new Error("Unable to find the esbuild binary path assignment to patch.");
}
