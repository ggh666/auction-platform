import { describe, expect, it } from "vitest";
import { resolveAdminApiBase } from "./client";

describe("admin API client", () => {
  it("uses the production API by default in production builds", () => {
    expect(resolveAdminApiBase({ MODE: "production" })).toBe("https://api-auction.toolmatrix.top");
  });

  it("uses the local API by default outside production builds", () => {
    expect(resolveAdminApiBase({ MODE: "development" })).toBe("http://127.0.0.1:3002");
  });

  it("honors an explicit VITE_API_BASE", () => {
    expect(resolveAdminApiBase({ MODE: "production", VITE_API_BASE: " https://custom.example.com/ " })).toBe(
      "https://custom.example.com"
    );
  });
});
