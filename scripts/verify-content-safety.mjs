#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

const modes = new Set(["local", "env", "callback", "text", "image", "approve", "help"]);
const mode = process.argv[2] ?? "help";

function usage() {
  console.log(`Usage:
  npm run verify:content-safety -- local
  npm run verify:content-safety -- env
  npm run verify:content-safety -- callback
  API_BASE=https://api-auction.toolmatrix.top TOKEN=... PRINCIPAL_ID=... npm run verify:content-safety -- text
  API_BASE=https://api-auction.toolmatrix.top TOKEN=... IMAGE_PATH=./safe-test.jpg npm run verify:content-safety -- image
  API_BASE=https://api-auction.toolmatrix.top ADMIN_TOKEN=... ASSET_ID=... npm run verify:content-safety -- approve

Environment:
  API_BASE       Production API base URL. Defaults to https://api-auction.toolmatrix.top.
  TOKEN          Miniapp user bearer token, without the "Bearer " prefix.
  PRINCIPAL_ID   Active principal id returned by GET /api/principals.
  IMAGE_PATH     Local JPG/PNG/WebP file for mediaCheckAsync smoke test.
  ADMIN_TOKEN    Admin bearer token, without the "Bearer " prefix.
  ASSET_ID       Asset id for admin approval smoke test.
  ENV_FILE       Server env file for env mode. Defaults to /etc/auction-api.env.
`);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function apiBase() {
  return (process.env.API_BASE?.trim() || "https://api-auction.toolmatrix.top").replace(/\/+$/, "");
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  console.log(`${options.method ?? "GET"} ${path} -> ${response.status}`);
  printJson(body);
  return { response, body };
}

function runLocalTests() {
  const result = spawnSync(
    "npm",
    [
      "--prefix",
      projectRoot,
      "test",
      "--",
      "tests/api/content-safety.test.ts",
      "tests/api/assets.test.ts",
      "tests/api/reports.test.ts"
    ],
    { stdio: "inherit" }
  );
  process.exitCode = result.status ?? 1;
}

function checkEnvFile() {
  const envFile = process.env.ENV_FILE?.trim() || "/etc/auction-api.env";
  const content = readFileSync(envFile, "utf8");
  const keys = ["WECHAT_APPID", "WECHAT_APP_SECRET", "WECHAT_EVENT_TOKEN", "CONTENT_SAFETY_ENABLED", "CONTENT_SAFETY_STRICT"];
  for (const key of keys) {
    const match = new RegExp(`^${key}=(.*)$`, "m").exec(content);
    const value = match?.[1]?.trim();
    if (!value) {
      console.log(`${key}=<missing>`);
      continue;
    }
    if (key.includes("SECRET") || key.includes("TOKEN")) {
      console.log(`${key}=<set>`);
    } else {
      console.log(`${key}=${value}`);
    }
  }
  console.log("\nRequired: CONTENT_SAFETY_ENABLED=true and CONTENT_SAFETY_STRICT=true");
}

async function checkCallbackReachable() {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = `verify-${Date.now()}`;
  const echostr = `content-safety-${Date.now()}`;
  console.log(`Open WeChat callback verification path in production: ${apiBase()}/api/wechat/events`);
  console.log("If WECHAT_EVENT_TOKEN is configured, the official WeChat platform must generate the signature.");
  console.log("This unauthenticated probe only proves the route is reachable when token validation is disabled.");
  await request(`/api/wechat/events?timestamp=${timestamp}&nonce=${nonce}&echostr=${encodeURIComponent(echostr)}`);
}

async function verifyTextSafety() {
  const token = requireEnv("TOKEN");
  const principalId = requireEnv("PRINCIPAL_ID");
  const originalEndAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await request("/api/assets", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({
      gameName: "塔防精灵",
      serverName: "内容安全验证区",
      assetType: "账号",
      principalId,
      title: "内容安全验证正常标题",
      description: "这是一条普通资产说明，用于验证微信文本安全接口正常放行",
      startingPriceCents: 100,
      minIncrementCents: 100,
      originalEndAt,
      images: []
    })
  });
  console.log("\nExpected: 200 with asset.status = pending_review.");
  console.log("To prove msgSecCheck fail-closed behavior, run this in a test environment with a deliberately bad WECHAT_APP_SECRET and expect 502 wechat_content_safety_failed.");
}

function mimeTypeFor(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  throw new Error("IMAGE_PATH must be a JPG, PNG, or WebP file");
}

async function verifyImageSafety() {
  const token = requireEnv("TOKEN");
  const imagePath = resolve(requireEnv("IMAGE_PATH"));
  const fileName = imagePath.split(/[\\/]/).pop() || "safe-test.jpg";
  const body = readFileSync(imagePath);
  await request("/api/images", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({
      fileName,
      mimeType: mimeTypeFor(imagePath),
      base64Data: body.toString("base64")
    })
  });
  console.log("\nExpected: image.safetyStatus = pending and image.safetyTraceId is present.");
  console.log("Then verify MySQL: SELECT public_url,status,trace_id,label,updated_at FROM content_safety_image_checks ORDER BY updated_at DESC LIMIT 10;");
}

async function verifyApprovalGate() {
  const adminToken = requireEnv("ADMIN_TOKEN");
  const assetId = requireEnv("ASSET_ID");
  await request(`/admin/assets/${encodeURIComponent(assetId)}/approve`, {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
    body: "{}"
  });
  console.log("\nExpected while image is pending: 400 image_safety_pending.");
  console.log("Expected after pass callback: 200. Expected after review/risky callback: 400 image_safety_risky.");
}

async function main() {
  if (!modes.has(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }
  if (mode === "help") {
    usage();
    return;
  }
  if (mode === "local") {
    runLocalTests();
    return;
  }
  if (mode === "env") {
    checkEnvFile();
    return;
  }
  if (mode === "callback") {
    await checkCallbackReachable();
    return;
  }
  if (mode === "text") {
    await verifyTextSafety();
    return;
  }
  if (mode === "image") {
    await verifyImageSafety();
    return;
  }
  if (mode === "approve") {
    await verifyApprovalGate();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
