import { describe, expect, it } from "vitest";
import { discoverRequiredNativePackages, nativePackageNameFor } from "../../scripts/ensure-native-deps.mjs";

describe("ensure native dependencies", () => {
  it("selects the native package for the current platform family", () => {
    expect(nativePackageNameFor("rollup", { platform: "darwin", arch: "x64" })).toBe("@rollup/rollup-darwin-x64");
    expect(nativePackageNameFor("rollup", { platform: "darwin", arch: "arm64" })).toBe("@rollup/rollup-darwin-arm64");
    expect(nativePackageNameFor("rollup", { platform: "linux", arch: "arm64", musl: false })).toBe(
      "@rollup/rollup-linux-arm64-gnu"
    );
    expect(nativePackageNameFor("rollup", { platform: "linux", arch: "arm64", musl: true })).toBe(
      "@rollup/rollup-linux-arm64-musl"
    );
    expect(nativePackageNameFor("esbuild", { platform: "linux", arch: "arm64" })).toBe("@esbuild/linux-arm64");
    expect(nativePackageNameFor("esbuild", { platform: "darwin", arch: "x64" })).toBe("@esbuild/darwin-x64");
  });

  it("discovers nested Rollup and esbuild native packages from package-lock", () => {
    const lockfile = {
      packages: {
        "node_modules/rollup": {
          optionalDependencies: {
            "@rollup/rollup-linux-arm64-gnu": "4.60.4"
          }
        },
        "node_modules/@rollup/rollup-linux-arm64-gnu": {
          version: "4.60.4",
          resolved: "https://registry.npmjs.org/@rollup/rollup-linux-arm64-gnu/-/rollup-linux-arm64-gnu-4.60.4.tgz",
          integrity: "sha512-test"
        },
        "admin/node_modules/esbuild": {
          optionalDependencies: {
            "@esbuild/darwin-x64": "0.21.5"
          }
        },
        "admin/node_modules/@esbuild/darwin-x64": {
          version: "0.21.5",
          resolved: "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.21.5.tgz",
          integrity: "sha512-test"
        }
      }
    };

    expect(discoverRequiredNativePackages(lockfile, { platform: "linux", arch: "arm64", musl: false })).toEqual([
      expect.objectContaining({
        nativePackageName: "@rollup/rollup-linux-arm64-gnu",
        expectedVersion: "4.60.4",
        targetPath: "node_modules/@rollup/rollup-linux-arm64-gnu"
      })
    ]);
    expect(discoverRequiredNativePackages(lockfile, { platform: "darwin", arch: "x64", musl: false })).toEqual([
      expect.objectContaining({
        nativePackageName: "@esbuild/darwin-x64",
        expectedVersion: "0.21.5",
        targetPath: "admin/node_modules/@esbuild/darwin-x64"
      })
    ]);
  });
});
