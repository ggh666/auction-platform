import type { ImageSafetyStatus } from "./contentSafety.service";

export type ImageSafetyRecord = {
  userId: string;
  objectKey: string;
  publicUrl: string;
  status: ImageSafetyStatus;
  traceId: string | null;
  label: number | null;
  detailJson: unknown | null;
  createdAt: string;
  updatedAt: string;
};

export type RecordImageSafetyInput = {
  userId: string;
  objectKey: string;
  publicUrl: string;
  status: ImageSafetyStatus;
  traceId?: string | null;
  label?: number | null;
  detailJson?: unknown | null;
};

export type UpdateImageSafetyInput = {
  traceId: string;
  status: ImageSafetyStatus;
  label?: number | null;
  detailJson?: unknown | null;
};

export type ImageSafetyRepository = {
  record(input: RecordImageSafetyInput): Promise<ImageSafetyRecord>;
  findByTraceId(traceId: string): Promise<ImageSafetyRecord | null>;
  findByPublicUrls(publicUrls: string[]): Promise<ImageSafetyRecord[]>;
  updateByTraceId(input: UpdateImageSafetyInput): Promise<void>;
};

function cloneRecord(record: ImageSafetyRecord): ImageSafetyRecord {
  return { ...record };
}

export function createInMemoryImageSafetyRepository(): ImageSafetyRepository {
  const records = new Map<string, ImageSafetyRecord>();

  return {
    async record(input) {
      const now = new Date().toISOString();
      const existing = records.get(input.publicUrl);
      const record: ImageSafetyRecord = {
        userId: input.userId,
        objectKey: input.objectKey,
        publicUrl: input.publicUrl,
        status: input.status,
        traceId: input.traceId ?? null,
        label: input.label ?? null,
        detailJson: input.detailJson ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      records.set(input.publicUrl, record);
      return cloneRecord(record);
    },
    async findByTraceId(traceId) {
      for (const record of records.values()) {
        if (record.traceId === traceId) {
          return cloneRecord(record);
        }
      }
      return null;
    },
    async findByPublicUrls(publicUrls) {
      return publicUrls.map((publicUrl) => records.get(publicUrl)).filter((record): record is ImageSafetyRecord => Boolean(record)).map(cloneRecord);
    },
    async updateByTraceId(input) {
      const now = new Date().toISOString();
      for (const record of records.values()) {
        if (record.traceId === input.traceId) {
          records.set(record.publicUrl, {
            ...record,
            status: input.status,
            label: input.label ?? null,
            detailJson: input.detailJson ?? null,
            updatedAt: now
          });
          return;
        }
      }
    }
  };
}
