import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import uniModule from "@dcloudio/vite-plugin-uni";

const root = dirname(fileURLToPath(import.meta.url));
const localEsbuildBinary = resolve(root, "node_modules/esbuild/bin/esbuild");

if (existsSync(localEsbuildBinary)) {
  process.env.ESBUILD_BINARY_PATH = localEsbuildBinary;
}

const uni = typeof uniModule === "function" ? uniModule : uniModule.default;
const priceChangeSubscribeTemplateId = (
  process.env.UNI_APP_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID ??
  process.env.VITE_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID ??
  ""
).trim();

export default defineConfig({
  envPrefix: ["VITE_", "UNI_APP_"],
  define: {
    __PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID__: JSON.stringify(priceChangeSubscribeTemplateId)
  },
  plugins: [uni()]
});
