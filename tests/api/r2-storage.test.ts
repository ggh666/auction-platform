import { describe, expect, it } from "vitest";
import type { Env } from "../../api/src/config/env";
import { S3Client } from "@aws-sdk/client-s3";
import { createR2Client, createR2ImageStorage } from "../../api/src/modules/images/r2Storage";

const env: Env = {
  nodeEnv: "production",
  host: "0.0.0.0",
  port: 3002,
  jwtSecret: "production-secret",
  mysqlUri: "mysql://auction:secret@127.0.0.1:3306/auction_platform",
  r2Endpoint: "https://account-id.r2.cloudflarestorage.com",
  r2AccessKeyId: "access-key",
  r2SecretAccessKey: "secret-key",
  r2Bucket: "auction",
  wechatAppId: "wx-test-appid",
  wechatAppSecret: "wx-test-secret"
};

describe("R2 image storage", () => {
  it("does not add optional request checksums to signed R2 uploads", async () => {
    const client = createR2Client(env);

    expect(client.config.requestChecksumCalculation).toBeDefined();
    await expect(client.config.requestChecksumCalculation!()).resolves.toBe("WHEN_REQUIRED");
  });

  it("uses the configured public base URL for stored image URLs", async () => {
    const envWithPublicBaseUrl = { ...env, r2PublicBaseUrl: "https://images.example.com/assets/" };
    const client = { send: async () => undefined } as unknown as S3Client;
    const storage = createR2ImageStorage(envWithPublicBaseUrl, client);

    const image = await storage.putImage({
      objectKey: "uploads/1/a.png",
      body: Buffer.from("image"),
      mimeType: "image/png"
    });

    expect(image.publicUrl).toBe("https://images.example.com/assets/uploads/1/a.png");
  });
});
