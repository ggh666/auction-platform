export type RestrictedUserAction = "bid" | "follow" | "unfollow";

const bannedActionMessages: Record<RestrictedUserAction, string> = {
  bid: "账号已被限制，暂不能出价",
  follow: "账号已被限制，暂不能关注",
  unfollow: "账号已被限制，暂不能取消关注"
};

const lowCreditActionMessages: Record<RestrictedUserAction, string> = {
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

export function isBidRestrictedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "User is temporarily restricted from bidding" || error.message === "User is restricted from bidding")
  );
}

export function isContentSafetyError(error: unknown): boolean {
  return error instanceof Error && contentSafetyFailureMessages.has(error.message);
}

export function restrictedActionFailureMessage(error: unknown, action: RestrictedUserAction, fallback: string): string {
  if (isContentSafetyError(error)) {
    return "内容包含敏感信息，请修改后再提交";
  }
  if (action === "bid" && isBidRestrictedError(error)) {
    const details = (error as { details?: { bidRestrictedUntil?: unknown; permanent?: unknown; reason?: unknown } }).details;
    const reason = typeof details?.reason === "string" && details.reason.trim() ? `，原因：${details.reason.trim()}` : "";
    if (details?.permanent === true) {
      return `账号已被永久限制出价${reason}。如需申诉请联系主理人或客服。`;
    }
    const until = typeof details?.bidRestrictedUntil === "string" ? details.bidRestrictedUntil : "";
    if (until) {
      return `账号已被临时限制出价至 ${formatRestrictionTime(until)}${reason}。如需申诉请联系主理人或客服。`;
    }
    return `账号已被临时限制出价${reason}。如需申诉请联系主理人或客服。`;
  }
  if (isBannedUserError(error)) {
    return bannedActionMessages[action];
  }
  if (isLowCreditError(error)) {
    return lowCreditActionMessages[action];
  }
  return fallback;
}

function formatRestrictionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
