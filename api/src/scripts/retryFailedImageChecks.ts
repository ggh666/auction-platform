import { stdout, stderr } from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { readEnv } from "../config/env";
import { createPool } from "../db/pool";
import { allRows, type MysqlExecutor } from "../db/mysqlTypes";
import { createWechatAccessTokenProvider } from "../modules/contentSafety/wechatAccessToken.service";

const wechatMediaDownloadErrorCode = -1008;

type FailedImageCheckRow = {
  id: number;
  uploader_id: number;
  object_key: string;
  public_url: string;
  status: string;
  trace_id: string | null;
  detail_json: string | object | null;
  user_openid: string | null;
};

type WechatMediaCheckResponse = {
  errcode?: unknown;
  errmsg?: unknown;
  trace_id?: unknown;
};

type RetryOptions = {
  id?: number;
  limit: number;
  dryRun: boolean;
  skipUrlCheck: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function decodeImageCheckDetail(value: string | object | null): unknown | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function isWechatMediaDownloadFailure(detailJson: unknown): boolean {
  return isRecord(detailJson) && Number(detailJson.errcode) === wechatMediaDownloadErrorCode;
}

export function retryOpenidForImageCheck(row: Pick<FailedImageCheckRow, "detail_json" | "user_openid">): string | null {
  if (row.user_openid?.trim()) {
    return row.user_openid.trim();
  }
  const detail = decodeImageCheckDetail(row.detail_json);
  if (!isRecord(detail)) {
    return null;
  }
  const callbackOpenid = detail.FromUserName ?? detail.fromUserName ?? detail.from_user_name;
  return typeof callbackOpenid === "string" && callbackOpenid.trim() ? callbackOpenid.trim() : null;
}

export function nextRetryAttemptForImageCheck(detailJson: unknown): number {
  if (!isRecord(detailJson)) {
    return 1;
  }
  const retryAttempt = isRecord(detailJson.retry) && Number.isInteger(detailJson.retry.attempt) ? Number(detailJson.retry.attempt) : 0;
  const failureAttempt =
    isRecord(detailJson.retryFailure) && Number.isInteger(detailJson.retryFailure.attempt) ? Number(detailJson.retryFailure.attempt) : 0;
  return Math.max(retryAttempt, failureAttempt, 0) + 1;
}

function detailWithRetryFailure(
  detailJson: unknown,
  input: { attempt: number; previousTraceId: string | null; reason: string; message: string }
): unknown {
  const base = isRecord(detailJson) ? detailJson : { callback: detailJson };
  return {
    ...base,
    retryFailure: {
      attempt: input.attempt,
      previousTraceId: input.previousTraceId,
      reason: input.reason,
      message: input.message
    }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : fallback;
}

async function loadFailedRows(db: MysqlExecutor, options: RetryOptions): Promise<FailedImageCheckRow[]> {
  if (options.id !== undefined) {
    const [rows] = await db.execute<FailedImageCheckRow[]>(
      `SELECT c.id, c.uploader_id, c.object_key, c.public_url, c.status, c.trace_id, c.detail_json, u.openid AS user_openid
       FROM content_safety_image_checks c
       LEFT JOIN users u ON u.id = c.uploader_id
       WHERE c.id = ?
       LIMIT 1`,
      [options.id]
    );
    return allRows<FailedImageCheckRow>(rows);
  }

  const [rows] = await db.execute<FailedImageCheckRow[]>(
    `SELECT c.id, c.uploader_id, c.object_key, c.public_url, c.status, c.trace_id, c.detail_json, u.openid AS user_openid
     FROM content_safety_image_checks c
     LEFT JOIN users u ON u.id = c.uploader_id
     WHERE c.status = 'failed'
     ORDER BY c.updated_at DESC
     LIMIT ?`,
    [options.limit]
  );
  return allRows<FailedImageCheckRow>(rows);
}

async function markRetryFailure(
  db: MysqlExecutor,
  row: FailedImageCheckRow,
  input: { attempt: number; reason: string; message: string }
): Promise<void> {
  const detail = decodeImageCheckDetail(row.detail_json);
  await db.execute(
    `UPDATE content_safety_image_checks
     SET status = 'failed', label = NULL, detail_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      JSON.stringify(
        detailWithRetryFailure(detail, {
          attempt: input.attempt,
          previousTraceId: row.trace_id,
          reason: input.reason,
          message: input.message
        })
      ),
      row.id
    ]
  );
}

async function assertPublicImageReadable(publicUrl: string): Promise<void> {
  const response = await fetch(publicUrl, { headers: { range: "bytes=0-0" } });
  await response.arrayBuffer();
  if (!response.ok && response.status !== 206) {
    throw new Error(`Public image URL is not readable: HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Public image URL is not an image: ${contentType || "<missing content-type>"}`);
  }
}

async function submitWechatImageCheck(input: { accessToken: string; publicUrl: string; openid: string }): Promise<WechatMediaCheckResponse> {
  const response = await fetch(`https://api.weixin.qq.com/wxa/media_check_async?access_token=${input.accessToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      media_url: input.publicUrl,
      media_type: 2,
      version: 2,
      scene: 3,
      openid: input.openid
    })
  });
  const body = (await response.json()) as WechatMediaCheckResponse;
  if (!response.ok) {
    throw new Error(`WeChat media check request failed: HTTP ${response.status}`);
  }
  if (typeof body.errcode === "number" && body.errcode !== 0) {
    throw new Error(typeof body.errmsg === "string" && body.errmsg ? body.errmsg : "WeChat media check request failed");
  }
  if (typeof body.trace_id !== "string" || !body.trace_id.trim()) {
    throw new Error("WeChat media check response is missing trace_id");
  }
  return body;
}

async function markRetryPending(db: MysqlExecutor, row: FailedImageCheckRow, body: WechatMediaCheckResponse, attempt: number): Promise<void> {
  await db.execute(
    `UPDATE content_safety_image_checks
     SET status = 'pending', trace_id = ?, label = NULL, detail_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      String(body.trace_id).trim(),
      JSON.stringify({
        ...body,
        retry: {
          attempt,
          previousTraceId: row.trace_id,
          reason: "manual_wechat_media_download_retry"
        }
      }),
      row.id
    ]
  );
}

export async function retryFailedImageChecks(db: MysqlExecutor, options: RetryOptions): Promise<{ scanned: number; retried: number; skipped: number }> {
  const rows = await loadFailedRows(db, options);
  const env = readEnv();
  const tokenProvider = createWechatAccessTokenProvider({ env });
  let retried = 0;
  let skipped = 0;

  for (const row of rows) {
    const detail = decodeImageCheckDetail(row.detail_json);
    if (row.status !== "failed" || !isWechatMediaDownloadFailure(detail)) {
      skipped += 1;
      stdout.write(`[skip] #${row.id} is not a failed -1008 image check\n`);
      continue;
    }

    const attempt = nextRetryAttemptForImageCheck(detail);
    const openid = retryOpenidForImageCheck(row);
    if (!openid) {
      skipped += 1;
      await markRetryFailure(db, row, {
        attempt,
        reason: "manual_wechat_media_download_retry_openid_missing",
        message: "WeChat openid is missing for retry"
      });
      stdout.write(`[failed] #${row.id} missing openid\n`);
      continue;
    }

    try {
      if (!options.skipUrlCheck) {
        await assertPublicImageReadable(row.public_url);
      }
      if (options.dryRun) {
        retried += 1;
        stdout.write(`[dry-run] #${row.id} would retry ${row.public_url}\n`);
        continue;
      }

      const accessToken = await tokenProvider.getAccessToken();
      const body = await submitWechatImageCheck({ accessToken, publicUrl: row.public_url, openid });
      await markRetryPending(db, row, body, attempt);
      retried += 1;
      stdout.write(`[retried] #${row.id} -> trace_id=${String(body.trace_id)}\n`);
    } catch (error) {
      skipped += 1;
      await markRetryFailure(db, row, {
        attempt,
        reason: "manual_wechat_media_download_retry_failed",
        message: errorMessage(error)
      });
      stdout.write(`[failed] #${row.id} ${errorMessage(error)}\n`);
    }
  }

  return { scanned: rows.length, retried, skipped };
}

function parseRetryOptions(): RetryOptions {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      limit: { type: "string", default: "20" },
      "dry-run": { type: "boolean", default: false },
      "skip-url-check": { type: "boolean", default: false }
    }
  });
  const id = values.id === undefined ? undefined : parsePositiveInteger(values.id, 0);
  if (values.id !== undefined && !id) {
    throw new Error("--id must be a positive integer");
  }
  return {
    id,
    limit: Math.min(parsePositiveInteger(values.limit, 20), 100),
    dryRun: values["dry-run"] === true,
    skipUrlCheck: values["skip-url-check"] === true
  };
}

async function main() {
  const options = parseRetryOptions();
  const pool = createPool();
  try {
    const result = await retryFailedImageChecks(pool, options);
    stdout.write(`Done. scanned=${result.scanned} retried=${result.retried} skipped=${result.skipped}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
