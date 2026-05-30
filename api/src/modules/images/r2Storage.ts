import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

export type ImageStorage = {
  putImage(input: PutImageInput): Promise<StoredImage>;
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
    }
  };
}
