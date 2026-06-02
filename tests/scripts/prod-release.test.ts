import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const releaseScript = resolve(projectRoot, "scripts/prod-release.sh");

describe("production release script", () => {
  it("verifies the release in a staging directory before stopping the running API", () => {
    const result = spawnSync("bash", [releaseScript, "--dry-run"], {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        ARCHIVE_PATH: resolve(projectRoot, "package.json"),
        APP_DIR: "/tmp/auction-platform-src",
        ADMIN_WEB_DIR: "/tmp/auction-admin",
        BACKUP_DIR: "/tmp/auction-backups",
        ENV_FILE: "/tmp/auction-api.env",
        NGINX_CONF: "/tmp/auction-platform.conf",
        DEPLOY_ADMIN: "false"
      }
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(output).toContain("/tmp/auction-platform-src.staging.");
    expect(output).toContain("npm ci --include=optional");
    expect(output.indexOf("systemctl stop auction-api")).toBeGreaterThan(output.indexOf("npm test"));
    expect(output.indexOf("Verifying active app directory contents: /tmp/auction-platform-src")).toBeGreaterThan(
      output.indexOf("mv /tmp/auction-platform-src.staging.")
    );
    expect(output.indexOf("Verifying auction-api runtime cwd is /tmp/auction-platform-src")).toBeGreaterThan(
      output.indexOf("curl -fsS http://127.0.0.1:3002/health")
    );
    expect(output).toContain("DEPLOY_ADMIN=false; skipping admin build and static deployment.");
  });
});
