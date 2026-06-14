import { describe, expect, it } from "vitest";
import { loginUrlForRedirect, safeLoginRedirect } from "./authNavigation";

describe("auth navigation helpers", () => {
  it("builds login URLs with encoded redirect targets", () => {
    expect(loginUrlForRedirect("/pages/auctions/detail?assetId=asset-1")).toBe(
      "/pages/login/login?redirect=%2Fpages%2Fauctions%2Fdetail%3FassetId%3Dasset-1"
    );
  });

  it("falls back when redirect targets are unsafe or recursive", () => {
    expect(safeLoginRedirect("https://example.com/path")).toBe("/pages/games/index");
    expect(safeLoginRedirect("//example.com/path")).toBe("/pages/games/index");
    expect(safeLoginRedirect("/pages/login/login")).toBe("/pages/games/index");
  });

  it("allows miniapp page redirects", () => {
    expect(safeLoginRedirect("/pages/profile/index")).toBe("/pages/profile/index");
    expect(safeLoginRedirect("%2Fpages%2Fexchange%2Fdetail%3FresourceId%3Dres-1")).toBe(
      "/pages/exchange/detail?resourceId=res-1"
    );
  });
});
