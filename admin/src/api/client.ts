import type { AdminLoginResponse } from "@auction/shared";
import { readAdminToken } from "../auth/session";

type AdminImportMetaEnv = {
  MODE?: string;
  VITE_API_BASE?: string;
};

const LOCAL_API_BASE = "http://127.0.0.1:3002";
const PRODUCTION_API_BASE = "https://api-auction.toolmatrix.top";

export function resolveAdminApiBase(env: AdminImportMetaEnv): string {
  const configured = env.VITE_API_BASE?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return env.MODE === "production" ? PRODUCTION_API_BASE : LOCAL_API_BASE;
}

const API_BASE = resolveAdminApiBase(import.meta.env);

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return new Error(body.error?.message ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
  const response = await fetch(`${API_BASE}/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    throw await parseError(response, "登录失败，请检查管理员账号和密码");
  }

  return response.json() as Promise<AdminLoginResponse>;
}

export async function adminGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${readAdminToken() ?? ""}` }
  });

  if (!response.ok) {
    throw await parseError(response, "请求失败，请稍后重试");
  }

  return response.json() as Promise<T>;
}

export async function adminDownload(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${readAdminToken() ?? ""}` }
  });

  if (!response.ok) {
    throw await parseError(response, "下载失败，请稍后重试");
  }

  return response.blob();
}

export async function adminPost<T>(path: string, payload?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${readAdminToken() ?? ""}`
  };
  if (payload !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await parseError(response, "操作失败，请稍后重试");
  }

  return response.json() as Promise<T>;
}

export async function adminPatch<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${readAdminToken() ?? ""}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await parseError(response, "操作失败，请稍后重试");
  }

  return response.json() as Promise<T>;
}

export async function adminPut<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${readAdminToken() ?? ""}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await parseError(response, "操作失败，请稍后重试");
  }

  return response.json() as Promise<T>;
}

export async function adminDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${readAdminToken() ?? ""}` }
  });

  if (!response.ok) {
    throw await parseError(response, "操作失败，请稍后重试");
  }

  return response.json() as Promise<T>;
}
