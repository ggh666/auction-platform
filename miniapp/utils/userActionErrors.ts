export type RestrictedUserAction = "publish" | "bid" | "follow" | "unfollow";

const bannedActionMessages: Record<RestrictedUserAction, string> = {
  publish: "账号已被限制，暂不能发布信息",
  bid: "账号已被限制，暂不能出价",
  follow: "账号已被限制，暂不能关注",
  unfollow: "账号已被限制，暂不能取消关注"
};

const lowCreditActionMessages: Record<RestrictedUserAction, string> = {
  publish: "信誉分不足，暂不能发布信息",
  bid: "信誉分不足，暂不能出价",
  follow: "信誉分不足，暂不能关注",
  unfollow: "信誉分不足，暂不能取消关注"
};

const contentSafetyFailureMessages = new Set([
  "Content safety check failed",
  "Content requires manual review",
  "Content failed safety check"
]);

export function isBannedUserError(error: unknown): boolean {
  return error instanceof Error && error.message === "User is banned";
}

export function isLowCreditError(error: unknown): boolean {
  return error instanceof Error && error.message === "Credit score is too low for this action";
}

export function isContentSafetyError(error: unknown): boolean {
  return error instanceof Error && contentSafetyFailureMessages.has(error.message);
}

export function restrictedActionFailureMessage(error: unknown, action: RestrictedUserAction, fallback: string): string {
  if (isContentSafetyError(error)) {
    return "内容包含敏感信息，请修改后再提交";
  }
  if (isBannedUserError(error)) {
    return bannedActionMessages[action];
  }
  if (isLowCreditError(error)) {
    return lowCreditActionMessages[action];
  }
  return fallback;
}
