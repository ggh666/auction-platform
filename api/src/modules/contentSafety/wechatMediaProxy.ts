import { createHmac, timingSafeEqual } from "node:crypto";

type TokenPayload = {
  objectKey: string;
  exp: number;
};

type CreateWechatMediaCheckTokenInput = {
  objectKey: string;
  secret: string;
  expiresAt: number;
};

type CreateWechatMediaCheckUrlInput = {
  baseUrl: string;
  objectKey: string;
  secret: string;
  ttlSeconds?: number;
  nowMs?: number;
};

type VerifyWechatMediaCheckTokenInput = {
  token: string;
  secret: string;
  nowMs?: number;
};

const defaultTtlSeconds = 24 * 60 * 60;

function base64UrlJson(value: TokenPayload): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signatureFor(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isSafeObjectKey(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && !value.startsWith("/") && !value.includes("..");
}

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function createWechatMediaCheckToken(input: CreateWechatMediaCheckTokenInput): string {
  const objectKey = input.objectKey.trim();
  if (!isSafeObjectKey(objectKey)) {
    throw new Error("Invalid WeChat media check object key");
  }
  if (!input.secret.trim()) {
    throw new Error("Invalid WeChat media check secret");
  }
  if (!Number.isInteger(input.expiresAt) || input.expiresAt <= 0) {
    throw new Error("Invalid WeChat media check expiry");
  }

  const payload = base64UrlJson({ objectKey, exp: input.expiresAt });
  return `${payload}.${signatureFor(payload, input.secret)}`;
}

export function createWechatMediaCheckUrl(input: CreateWechatMediaCheckUrlInput): string {
  const nowMs = input.nowMs ?? Date.now();
  const expiresAt = Math.floor(nowMs / 1000) + (input.ttlSeconds ?? defaultTtlSeconds);
  const token = createWechatMediaCheckToken({
    objectKey: input.objectKey,
    secret: input.secret,
    expiresAt
  });
  return `${trimBaseUrl(input.baseUrl)}/api/wechat/media-check-image/${token}`;
}

export function verifyWechatMediaCheckToken(input: VerifyWechatMediaCheckTokenInput): { objectKey: string } | null {
  const [payload, signature, extra] = input.token.split(".");
  if (!payload || !signature || extra !== undefined || !input.secret.trim()) {
    return null;
  }

  const expected = signatureFor(payload, input.secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    return null;
  }

  const objectKey = (decoded as TokenPayload).objectKey;
  const exp = (decoded as TokenPayload).exp;
  if (!isSafeObjectKey(objectKey) || !Number.isInteger(exp)) {
    return null;
  }
  if (exp < Math.floor((input.nowMs ?? Date.now()) / 1000)) {
    return null;
  }
  return { objectKey };
}
