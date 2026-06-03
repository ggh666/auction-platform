import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const detailPagePath = resolve(import.meta.dirname, "auctions/detail.vue");
const profilePagePath = resolve(import.meta.dirname, "profile/index.vue");
const resultsPagePath = resolve(import.meta.dirname, "profile/results.vue");

describe("miniapp customer service entry placement", () => {
  it("does not show a customer service entry on asset detail", () => {
    const page = readFileSync(detailPagePath, "utf8");

    expect(page).not.toContain('open-type="contact"');
    expect(page).not.toContain("联系平台客服");
    expect(page).not.toContain("assetCustomerServiceContact");
    expect(page).not.toContain("buildAssetCustomerServiceContact");
    expect(page).not.toContain("ensureCustomerServiceLogin");
  });

  it("adds a global customer service entry to profile", () => {
    const page = readFileSync(profilePagePath, "utf8");

    expect(page).toContain('open-type="contact"');
    expect(page).toContain("联系客服");
    expect(page).toContain("profileCustomerServiceContact");
    expect(page).toContain("buildProfileCustomerServiceContact");
  });

  it("does not show customer service entries on deal followups", () => {
    const page = readFileSync(resultsPagePath, "utf8");

    expect(page).not.toContain('open-type="contact"');
    expect(page).not.toContain("联系主理人客服");
    expect(page).not.toContain("followupCustomerServiceContact(followup)");
    expect(page).not.toContain("buildFollowupCustomerServiceContact");
  });
});
