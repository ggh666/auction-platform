import { describe, expect, it } from "vitest";
import { restrictedActionFailureMessage } from "./userActionErrors";

describe("miniapp restricted user action messages", () => {
  it("maps banned user errors to action-specific messages", () => {
    expect(restrictedActionFailureMessage(new Error("User is banned"), "publish", "fallback")).toBe(
      "账号已被限制，暂不能发布信息"
    );
    expect(restrictedActionFailureMessage(new Error("User is banned"), "bid", "fallback")).toBe("账号已被限制，暂不能出价");
    expect(restrictedActionFailureMessage(new Error("User is banned"), "follow", "fallback")).toBe("账号已被限制，暂不能关注");
  });

  it("maps low credit errors to action-specific messages", () => {
    expect(restrictedActionFailureMessage(new Error("Credit score is too low for this action"), "publish", "fallback")).toBe(
      "信誉分不足，暂不能发布信息"
    );
    expect(restrictedActionFailureMessage(new Error("Credit score is too low for this action"), "bid", "fallback")).toBe(
      "信誉分不足，暂不能出价"
    );
    expect(restrictedActionFailureMessage(new Error("Credit score is too low for this action"), "follow", "fallback")).toBe(
      "信誉分不足，暂不能关注"
    );
  });

  it("keeps the fallback message for unrelated errors", () => {
    expect(restrictedActionFailureMessage(new Error("Authentication required"), "publish", "fallback")).toBe("fallback");
  });

  it("maps content safety errors to a sensitive content message", () => {
    expect(restrictedActionFailureMessage(new Error("Content safety check failed"), "publish", "fallback")).toBe(
      "内容包含敏感信息，请修改后再提交"
    );
    expect(restrictedActionFailureMessage(new Error("Content requires manual review"), "publish", "fallback")).toBe(
      "内容包含敏感信息，请修改后再提交"
    );
    expect(restrictedActionFailureMessage(new Error("Content failed safety check"), "bid", "fallback")).toBe(
      "内容包含敏感信息，请修改后再提交"
    );
  });
});
