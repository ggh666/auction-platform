import type { AdminLoginResponse } from "@auction/shared";

const TOKEN_KEY = "auction.admin.token";
const ADMIN_KEY = "auction.admin.user";

export type AdminSession = AdminLoginResponse["admin"];

export function readAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function saveAdminSession(token: string, admin: AdminSession): void {
  saveAdminToken(token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function readAdminSession(): AdminSession | null {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) {
    return null;
  }
  try {
    const admin = JSON.parse(raw) as AdminSession;
    return admin && typeof admin.id === "string" && typeof admin.username === "string" ? admin : null;
  } catch {
    return null;
  }
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}
