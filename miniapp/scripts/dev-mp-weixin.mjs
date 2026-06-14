import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const patchScript = resolve(root, "scripts/patch-mp-weixin-project-config.mjs");
const syncScript = resolve(root, "scripts/sync-mp-weixin-devtools-output.mjs");
const env = {
  ...process.env,
  ESBUILD_BINARY_PATH: resolve(root, "node_modules/@esbuild/darwin-x64/bin/esbuild"),
  UNI_INPUT_DIR: root
};

function patchGeneratedConfigs(args = ["--quiet", "--allow-missing-app-json"]) {
  spawnSync(process.execPath, [patchScript, ...args], {
    cwd: root,
    env,
    stdio: "inherit"
  });
}

function syncStableDevtoolsOutput(args = ["--source", "dist/dev/mp-weixin", "--quiet", "--allow-missing"]) {
  spawnSync(process.execPath, [syncScript, ...args], {
    cwd: root,
    env,
    stdio: "inherit"
  });
}

function refreshDevtoolsOutput() {
  patchGeneratedConfigs();
  syncStableDevtoolsOutput();
}

refreshDevtoolsOutput();

const patchTimer = setInterval(() => {
  refreshDevtoolsOutput();
}, 1000);

const child = spawn("uni", ["-p", "mp-weixin"], {
  cwd: root,
  env,
  shell: true,
  stdio: "inherit"
});

function finish(exitCode = 0) {
  clearInterval(patchTimer);
  refreshDevtoolsOutput();
  process.exit(exitCode);
}

child.on("exit", (code) => {
  finish(typeof code === "number" ? code : 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
    finish(0);
  });
}
