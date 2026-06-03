import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const resultsPagePath = resolve(import.meta.dirname, "profile/results.vue");

describe("profile results page", () => {
  it("paginates result records, shows asset names, and keeps deal completion/contact read-only for users", () => {
    const page = readFileSync(resultsPagePath, "utf8");

    expect(page).toContain("onReachBottom");
    expect(page).toContain("page: requestedPage");
    expect(page).toContain("pageSize");
    expect(page).toContain("result.asset.title");
    expect(page).not.toContain("listMyDealFollowups");
    expect(page).not.toContain("submitDealFollowupContact");
    expect(page).not.toContain("成交跟进");
    expect(page).not.toContain("补充联系信息");
    expect(page).not.toContain("提交联系信息");
    expect(page).not.toContain("privacyAccepted: contactPrivacyAccepted.value");
    expect(page).not.toContain("信息仅用于成交后主理人联系");
    expect(page).not.toContain("confirmDealFollowup");
    expect(page).not.toContain("abandonDealFollowup");
    expect(page).not.toContain("确认成交");
    expect(page).not.toContain("放弃成交");
    expect(page).not.toContain("confirmTradingDisclaimer");
    expect(page).not.toContain("readSessionUser");
  });

  it("keeps the historical results layout readable on narrow miniapp screens", () => {
    const page = readFileSync(resultsPagePath, "utf8");

    expect(page).not.toContain('<text class="title">成交记录</text>');
    expect(page).toContain('class="section-heading results-heading"');
    expect(page).toContain("历史成交");
    expect(page).not.toContain(".contact-input");
    expect(page).not.toContain(".contact-textarea");
    expect(page).not.toContain(".followup-actions");
    expect(page).not.toContain(".privacy-check label");
  });
});
