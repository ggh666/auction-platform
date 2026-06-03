import { describe, expect, it } from "vitest";
import { restrictedActionFailureMessage } from "./userActionErrors";

describe("miniapp restricted user action messages", () => {
  it("maps banned user errors to action-specific messages", () => {
    expect(restrictedActionFailureMessage(new Error("User is banned"), "bid", "fallback")).toBe("账号已被限制，暂不能出价");
    expect(restrictedActionFailureMessage(new Error("User is banned"), "follow", "fallback")).toBe("账号已被限制，暂不能关注");
  });

  it("maps low credit errors to action-specific messages", () => {
    expect(restrictedActionFailureMessage(new Error("Credit score is too low for this action"), "bid", "fallback")).toBe(
      "信誉分不足，暂不能出价"
    );
    expect(restrictedActionFailureMessage(new Error("Credit score is too low for this action"), "follow", "fallback")).toBe(
      "信誉分不足，暂不能关注"
    );
  });

  it("keeps the fallback message for unrelated errors", () => {
    expect(restrictedActionFailureMessage(new Error("Authentication required"), "bid", "fallback")).toBe("fallback");
  });

  it("maps content safety errors to a sensitive content message", () => {
    expect(restrictedActionFailureMessage(new Error("Content safety check failed"), "follow", "fallback")).toBe(
      "内容包含敏感信息，请修改后再提交"
    );
    expect(restrictedActionFailureMessage(new Error("Content requires manual review"), "unfollow", "fallback")).toBe(
      "内容包含敏感信息，请修改后再提交"
    );
    expect(restrictedActionFailureMessage(new Error("Content failed safety check"), "bid", "fallback")).toBe(
      "内容包含敏感信息，请修改后再提交"
    );
  });

  it("explains bid restrictions and points users to principals or customer service", () => {
    expect(
      restrictedActionFailureMessage(
        Object.assign(new Error("User is temporarily restricted from bidding"), {
          details: { bidRestrictedUntil: "2026-06-03T12:30:00.000Z", reason: "疑似故意抬价" }
        }),
        "bid",
        "fallback"
      )
    ).toContain("如需申诉请联系主理人或客服");
    expect(
      restrictedActionFailureMessage(
        Object.assign(new Error("User is restricted from bidding"), {
          details: { permanent: true, reason: "疑似故意抬价" }
        }),
        "bid",
        "fallback"
      )
    ).toBe("账号已被永久限制出价，原因：疑似故意抬价。如需申诉请联系主理人或客服。");
  });
});
