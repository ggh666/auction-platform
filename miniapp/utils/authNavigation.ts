import { readSessionUser } from "../auth/session";

const LOGIN_PATH = "/pages/login/login";

export function currentPageUrl(): string {
  const pages = getCurrentPages();
  const currentPage = pages.length > 0 ? pages[pages.length - 1] : null;
  const route = currentPage?.route ? `/${currentPage.route}` : "/pages/games/index";
  const pageOptions = (currentPage as unknown as { options?: Record<string, unknown> } | null)?.options ?? {};
  const options = pageOptions as Record<string, unknown>;
  const query = Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return query ? `${route}?${query}` : route;
}

export function safeLoginRedirect(value: unknown): string {
  if (typeof value !== "string") {
    return "/pages/games/index";
  }

  const decoded = decodeURIComponent(value);
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("://")) {
    return "/pages/games/index";
  }

  if (decoded.startsWith(LOGIN_PATH)) {
    return "/pages/games/index";
  }

  return decoded;
}

export function loginUrlForRedirect(redirectUrl: string = currentPageUrl()): string {
  return `${LOGIN_PATH}?redirect=${encodeURIComponent(redirectUrl)}`;
}

export function requireLoginForAction(message: string, redirectUrl: string = currentPageUrl()): boolean {
  if (readSessionUser()) {
    return true;
  }

  uni.showToast({ title: message, icon: "none" });
  uni.navigateTo({ url: loginUrlForRedirect(redirectUrl) });
  return false;
}

export function navigateAfterLogin(redirectUrl: string) {
  const targetUrl = safeLoginRedirect(redirectUrl);
  const tabPaths = ["/pages/games/index", "/pages/guides/index", "/pages/profile/index"];
  if (tabPaths.includes(targetUrl)) {
    uni.switchTab({ url: targetUrl });
    return;
  }

  uni.redirectTo({ url: targetUrl });
}
