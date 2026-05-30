import type { MysqlExecutor, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, toIsoString } from "../../db/mysqlTypes";
import type { ImageSafetyStatus } from "./contentSafety.service";
import type { ImageSafetyRecord, ImageSafetyRepository } from "./imageSafety.repository";

type ImageSafetyDbRow = {
  uploader_id: number;
  object_key: string;
  public_url: string;
  status: ImageSafetyStatus;
  trace_id: string | null;
  label: number | null;
  detail_json: string | object | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function decodeJson(value: string | object | null): unknown | null {
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

function encodeJson(value: unknown | null | undefined): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function toRecord(row: ImageSafetyDbRow): ImageSafetyRecord {
  return {
    userId: String(row.uploader_id),
    objectKey: row.object_key,
    publicUrl: row.public_url,
    status: row.status,
    traceId: row.trace_id,
    label: row.label,
    detailJson: decodeJson(row.detail_json),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export function createMysqlImageSafetyRepository(db: MysqlExecutor): ImageSafetyRepository {
  return {
    async record(input) {
      await db.execute<MysqlResultHeader>(
        `INSERT INTO content_safety_image_checks (
           uploader_id,
           object_key,
           public_url,
           status,
           trace_id,
           label,
           detail_json
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           trace_id = VALUES(trace_id),
           label = VALUES(label),
           detail_json = VALUES(detail_json),
           updated_at = CURRENT_TIMESTAMP`,
        [
          Number(input.userId),
          input.objectKey,
          input.publicUrl,
          input.status,
          input.traceId ?? null,
          input.label ?? null,
          encodeJson(input.detailJson)
        ]
      );
      const [rows] = await db.execute<ImageSafetyDbRow[]>(
        `SELECT uploader_id, object_key, public_url, status, trace_id, label, detail_json, created_at, updated_at
         FROM content_safety_image_checks
         WHERE public_url = ?
         LIMIT 1`,
        [input.publicUrl]
      );
      const record = allRows<ImageSafetyDbRow>(rows)[0];
      if (!record) {
        throw new Error("Image safety record could not be read");
      }
      return toRecord(record);
    },

    async findByPublicUrls(publicUrls) {
      if (publicUrls.length === 0) {
        return [];
      }
      const placeholders = publicUrls.map(() => "?").join(", ");
      const [rows] = await db.execute<ImageSafetyDbRow[]>(
        `SELECT uploader_id, object_key, public_url, status, trace_id, label, detail_json, created_at, updated_at
         FROM content_safety_image_checks
         WHERE public_url IN (${placeholders})`,
        publicUrls
      );
      return allRows<ImageSafetyDbRow>(rows).map(toRecord);
    },

    async updateByTraceId(input) {
      await db.execute<MysqlResultHeader>(
        `UPDATE content_safety_image_checks
         SET status = ?, label = ?, detail_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE trace_id = ?`,
        [input.status, input.label ?? null, encodeJson(input.detailJson), input.traceId]
      );
    }
  };
}
