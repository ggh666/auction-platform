export const USER_ASSET_SUBMIT_DISABLED_REASON = "暂未开放用户提交资产";

const legacyDisabledReasonPatterns = [/用户发布资产/];

export function normalizeUserAssetSubmitDisabledReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim();
  if (!trimmed) {
    return USER_ASSET_SUBMIT_DISABLED_REASON;
  }
  if (legacyDisabledReasonPatterns.some((pattern) => pattern.test(trimmed))) {
    return USER_ASSET_SUBMIT_DISABLED_REASON;
  }
  return trimmed;
}
