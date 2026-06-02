import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readEnv } from "../../config/env";

export type StoredImage = {
  objectKey: string;
  publicUrl: string;
};

export type PutImageInput = {
  objectKey: string;
  body: Buffer;
  mimeType: string;
};

export type StoredImageObject = {
  body: Buffer;
  mimeType: string;
  sizeBytes: number;
};

export type ImageStorage = {
  putImage(input: PutImageInput): Promise<StoredImage>;
  getImage(objectKey: string): Promise<StoredImageObject | null>;
};

function joinUrl(baseUrl: string, objectKey: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${objectKey.replace(/^\/+/, "")}`;
}

function publicUrlForObject(env: ReturnType<typeof readEnv>, objectKey: string): string {
  if (env.r2PublicBaseUrl) {
    return joinUrl(env.r2PublicBaseUrl, objectKey);
  }

  return joinUrl(`${env.r2Endpoint.replace(/\/+$/, "")}/${env.r2Bucket}`, objectKey);
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const metadata = "$metadata" in error ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata : undefined;
  return error.name === "NoSuchKey" || error.name === "NotFound" || metadata?.httpStatusCode === 404;
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === "object" && body !== null && "transformToByteArray" in body) {
    const transformToByteArray = (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray;
    if (typeof transformToByteArray === "function") {
      return Buffer.from(await transformToByteArray.call(body));
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function createR2Client(env = readEnv()): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: env.r2Endpoint,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey
    }
  });
}

export function createR2ImageStorage(env = readEnv(), client = createR2Client(env)): ImageStorage {
  return {
    async putImage(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: env.r2Bucket,
          Key: input.objectKey,
          Body: input.body,
          ContentType: input.mimeType
        })
      );

      return {
        objectKey: input.objectKey,
        publicUrl: publicUrlForObject(env, input.objectKey)
      };
    },

    async getImage(objectKey) {
      try {
        const result = await client.send(
          new GetObjectCommand({
            Bucket: env.r2Bucket,
            Key: objectKey
          })
        );
        const body = await bodyToBuffer(result.Body);
        if (body.length === 0) {
          return null;
        }
        return {
          body,
          mimeType: result.ContentType || "application/octet-stream",
          sizeBytes: result.ContentLength ?? body.length
        };
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    }
  };
}
