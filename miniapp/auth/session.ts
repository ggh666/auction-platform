import type { LoginResponse, UserSummary } from "@auction/shared";

const TOKEN_KEY = "auction.user.token";
const USER_KEY = "auction.user.profile";

export function readToken(): string | null {
  return uni.getStorageSync(TOKEN_KEY) || null;
}

export function readSessionUser(): UserSummary | null {
  const stored = uni.getStorageSync(USER_KEY);
  if (typeof stored === "object" && stored !== null && "id" in stored) {
    return stored as UserSummary;
  }

  return null;
}

export function saveToken(token: string): void {
  uni.setStorageSync(TOKEN_KEY, token);
}

export function saveSession(session: LoginResponse): void {
  saveToken(session.token);
  uni.setStorageSync(USER_KEY, session.user);
}

export function clearSession(): void {
  uni.removeStorageSync(TOKEN_KEY);
  uni.removeStorageSync(USER_KEY);
}

export const clearToken = clearSession;
