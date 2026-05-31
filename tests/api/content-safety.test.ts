import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { buildApp } from "../../api/src/app";
import { HttpError } from "../../api/src/http/errors";
import { createInMemoryImageSafetyRepository } from "../../api/src/modules/contentSafety/imageSafety.repository";
import { createWechatAccessTokenProvider } from "../../api/src/modules/contentSafety/wechatAccessToken.service";
import { createWechatContentSafetyService } from "../../api/src/modules/contentSafety/wechatContentSafety.service";
import { createInMemoryAssetsRepository } from "../../api/src/modules/assets/assets.repository";
import { createInMemoryUsersRepository } from "../../api/src/modules/users/users.repository";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    async json() {
      return body;
    }
  } as Response;
}

describe("WeChat content safety", () => {
  it("caches stable access tokens before expiry", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ access_token: "token-1", expires_in: 7200 }));
    const provider = createWechatAccessTokenProvider({
      env: { wechatAppId: "wx-app", wechatAppSecret: "secret" },
      fetchImpl
    });

    await expect(provider.getAccessToken()).resolves.toBe("token-1");
    await expect(provider.getAccessToken()).resolves.toBe("token-1");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/cgi-bin/stable_token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          grant_type: "client_credential",
          appid: "wx-app",
          secret: "secret",
          force_refresh: false
        })
      })
    );
  });

  it("blocks risky text returned by msgSecCheck", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errcode: 0,
        result: { suggest: "risky", label: 20001 },
        trace_id: "text-trace"
      })
    );
    const service = createWechatContentSafetyService({
      enabled: true,
      strict: true,
      tokenProvider: { getAccessToken: async () => "token-1" },
      imageSafetyRepository: createInMemoryImageSafetyRepository(),
      assetsRepository: createInMemoryAssetsRepository(),
      fetchImpl
    });

    await expect(service.assertTextAllowed({ content: "违规广告", openid: "openid-1", scene: 3 })).rejects.toMatchObject({
      statusCode: 400,
      code: "content_safety_risky"
    } satisfies Partial<HttpError>);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/wxa/msg_sec_check?access_token=token-1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          content: "违规广告",
          version: 2,
          scene: 3,
          openid: "openid-1"
        })
      })
    );
  });

  it("blocks explicit prohibited marketplace terms before calling msgSecCheck", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errcode: 0,
        result: { suggest: "pass", label: 100 },
        trace_id: "text-trace"
      })
    );
    const service = createWechatContentSafetyService({
      enabled: true,
      strict: true,
      tokenProvider: { getAccessToken: async () => "token-1" },
      imageSafetyRepository: createInMemoryImageSafetyRepository(),
      assetsRepository: createInMemoryAssetsRepository(),
      fetchImpl
    });

    await expect(
      service.assertTextAllowed({
        content: "塔防精灵\n赌博\n道具\n卖淫\n偷盗",
        openid: "openid-1",
        scene: 3
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "content_safety_risky",
      details: expect.objectContaining({ source: "local_text_policy" })
    } satisfies Partial<HttpError>);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requests async image checks and updates callback result by trace id", async () => {
    const imageSafetyRepository = createInMemoryImageSafetyRepository();
    const fetchImpl = vi.fn(async () => jsonResponse({ errcode: 0, trace_id: "image-trace" }));
    const service = createWechatContentSafetyService({
      enabled: true,
      strict: true,
      tokenProvider: { getAccessToken: async () => "token-1" },
      imageSafetyRepository,
      assetsRepository: createInMemoryAssetsRepository(),
      fetchImpl
    });

    await expect(
      service.requestImageCheck({
        userId: "1",
        objectKey: "uploads/1/a.png",
        mediaUrl: "https://img.example.com/uploads/1/a.png",
        openid: "openid-1",
        scene: 3
      })
    ).resolves.toEqual({ status: "pending", traceId: "image-trace" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/wxa/media_check_async?access_token=token-1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          media_url: "https://img.example.com/uploads/1/a.png",
          media_type: 2,
          version: 2,
          scene: 3,
          openid: "openid-1"
        })
      })
    );

    await service.handleImageCheckCallback({
      trace_id: "image-trace",
      result: { suggest: "pass", label: 100 },
      detail: [{ strategy: "content_model", suggest: "pass", label: 100 }]
    });

    await expect(imageSafetyRepository.findByPublicUrls(["https://img.example.com/uploads/1/a.png"])).resolves.toEqual([
      expect.objectContaining({
        status: "pass",
        traceId: "image-trace",
        label: 100
      })
    ]);
  });

  it("retries async image checks when WeChat reports a media download error", async () => {
    const imageSafetyRepository = createInMemoryImageSafetyRepository();
    const usersRepository = createInMemoryUsersRepository();
    await usersRepository.findOrCreateWechatUser({ openid: "openid-1", displayName: "图片上传用户" });
    const scheduledRetries: Array<() => Promise<void>> = [];
    const retryDelays: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ errcode: 0, trace_id: "image-trace-1" }))
      .mockResolvedValueOnce(jsonResponse({ errcode: 0, trace_id: "image-trace-2" }));
    const service = createWechatContentSafetyService({
      enabled: true,
      strict: true,
      tokenProvider: { getAccessToken: async () => "token-1" },
      imageSafetyRepository,
      assetsRepository: createInMemoryAssetsRepository(),
      usersRepository,
      imageDownloadRetryDelayMs: 30_000,
      imageDownloadRetryScheduler(task, delayMs) {
        retryDelays.push(delayMs);
        scheduledRetries.push(task);
      },
      fetchImpl
    });

    await service.requestImageCheck({
      userId: "1",
      objectKey: "uploads/items/1/a.jpg",
      mediaUrl: "https://img.example.com/uploads/items/1/a.jpg",
      openid: "openid-1",
      scene: 3
    });

    await service.handleImageCheckCallback({
      trace_id: "image-trace-1",
      errcode: -1008,
      errmsg: "下载错误，请检查媒体链接是否有效",
      detail: []
    });

    await expect(imageSafetyRepository.findByPublicUrls(["https://img.example.com/uploads/items/1/a.jpg"])).resolves.toEqual([
      expect.objectContaining({
        status: "failed",
        traceId: "image-trace-1"
      })
    ]);
    expect(retryDelays).toEqual([30_000]);
    expect(scheduledRetries).toHaveLength(1);

    await scheduledRetries[0]();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      "https://api.weixin.qq.com/wxa/media_check_async?access_token=token-1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          media_url: "https://img.example.com/uploads/items/1/a.jpg",
          media_type: 2,
          version: 2,
          scene: 3,
          openid: "openid-1"
        })
      })
    );
    await expect(imageSafetyRepository.findByPublicUrls(["https://img.example.com/uploads/items/1/a.jpg"])).resolves.toEqual([
      expect.objectContaining({
        status: "pending",
        traceId: "image-trace-2",
        detailJson: expect.objectContaining({
          retry: expect.objectContaining({
            attempt: 1,
            previousTraceId: "image-trace-1",
            reason: "wechat_media_download_error"
          })
        })
      })
    ]);
  });

  it("uses the WeChat callback openid when retrying a download error without a stored user openid", async () => {
    const imageSafetyRepository = createInMemoryImageSafetyRepository();
    const usersRepository = createInMemoryUsersRepository();
    await usersRepository.findOrCreateMockUser("无 openid 用户");
    const scheduledRetries: Array<() => Promise<void>> = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ errcode: 0, trace_id: "image-trace-1" }))
      .mockResolvedValueOnce(jsonResponse({ errcode: 0, trace_id: "image-trace-2" }));
    const service = createWechatContentSafetyService({
      enabled: true,
      strict: true,
      tokenProvider: { getAccessToken: async () => "token-1" },
      imageSafetyRepository,
      assetsRepository: createInMemoryAssetsRepository(),
      usersRepository,
      imageDownloadRetryScheduler(task) {
        scheduledRetries.push(task);
      },
      fetchImpl
    });

    await service.requestImageCheck({
      userId: "1",
      objectKey: "uploads/items/1/fallback.jpg",
      mediaUrl: "https://img.example.com/uploads/items/1/fallback.jpg",
      openid: "initial-openid",
      scene: 3
    });

    await service.handleImageCheckCallback({
      trace_id: "image-trace-1",
      errcode: -1008,
      errmsg: "下载错误，请检查媒体链接是否有效",
      FromUserName: "callback-openid"
    });
    await scheduledRetries[0]();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      "https://api.weixin.qq.com/wxa/media_check_async?access_token=token-1",
      expect.objectContaining({
        body: JSON.stringify({
          media_url: "https://img.example.com/uploads/items/1/fallback.jpg",
          media_type: 2,
          version: 2,
          scene: 3,
          openid: "callback-openid"
        })
      })
    );
  });

  it("records retry failure details when a download-error retry cannot be submitted", async () => {
    const imageSafetyRepository = createInMemoryImageSafetyRepository();
    const usersRepository = createInMemoryUsersRepository();
    await usersRepository.findOrCreateWechatUser({ openid: "openid-1", displayName: "图片上传用户" });
    const scheduledRetries: Array<() => Promise<void>> = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ errcode: 0, trace_id: "image-trace-1" }))
      .mockResolvedValueOnce(jsonResponse({ errcode: 40001, errmsg: "invalid credential" }));
    const service = createWechatContentSafetyService({
      enabled: true,
      strict: true,
      tokenProvider: { getAccessToken: async () => "token-1" },
      imageSafetyRepository,
      assetsRepository: createInMemoryAssetsRepository(),
      usersRepository,
      imageDownloadRetryScheduler(task) {
        scheduledRetries.push(task);
      },
      fetchImpl
    });

    await service.requestImageCheck({
      userId: "1",
      objectKey: "uploads/items/1/retry-fail.jpg",
      mediaUrl: "https://img.example.com/uploads/items/1/retry-fail.jpg",
      openid: "openid-1",
      scene: 3
    });

    await service.handleImageCheckCallback({
      trace_id: "image-trace-1",
      errcode: -1008,
      errmsg: "下载错误，请检查媒体链接是否有效"
    });
    await expect(scheduledRetries[0]()).resolves.toBeUndefined();

    await expect(imageSafetyRepository.findByPublicUrls(["https://img.example.com/uploads/items/1/retry-fail.jpg"])).resolves.toEqual([
      expect.objectContaining({
        status: "failed",
        traceId: "image-trace-1",
        detailJson: expect.objectContaining({
          retryFailure: expect.objectContaining({
            attempt: 1,
            previousTraceId: "image-trace-1",
            reason: "wechat_media_download_retry_failed",
            message: "invalid credential"
          })
        })
      })
    ]);
  });

  it("allows image checks that require manual review to be decided by the admin reviewer", async () => {
    const imageSafetyRepository = createInMemoryImageSafetyRepository();
    const assetsRepository = createInMemoryAssetsRepository();
    const service = createWechatContentSafetyService({
      enabled: true,
      strict: true,
      tokenProvider: { getAccessToken: async () => "token-1" },
      imageSafetyRepository,
      assetsRepository
    });
    const publicUrl = "https://img.example.com/uploads/1/camera.jpg";
    const asset = await assetsRepository.createPending({
      sellerId: "1",
      principalId: "1",
      gameName: "塔防精灵",
      serverName: "测试区",
      assetType: "账号",
      title: "正常拍照图片",
      description: "测试图片复核",
      startingPriceCents: 100,
      minIncrementCents: 100,
      originalEndAt: new Date(Date.now() + 60_000).toISOString(),
      images: [{ objectKey: "uploads/1/camera.jpg", publicUrl, mimeType: "image/jpeg", sizeBytes: 1024 }]
    });
    await imageSafetyRepository.record({
      userId: "1",
      objectKey: "uploads/1/camera.jpg",
      publicUrl,
      status: "review",
      traceId: "image-trace",
      label: 20006
    });

    await expect(service.assertAssetImagesAllowed(asset.id)).resolves.toBeUndefined();
  });

  it("blocks asset images that do not have upload safety records", async () => {
    const imageSafetyRepository = createInMemoryImageSafetyRepository();
    const assetsRepository = createInMemoryAssetsRepository();
    const service = createWechatContentSafetyService({
      enabled: true,
      strict: true,
      tokenProvider: { getAccessToken: async () => "token-1" },
      imageSafetyRepository,
      assetsRepository
    });
    const publicUrl = "https://img.example.com/uploads/1/untracked.jpg";
    const asset = await assetsRepository.createPending({
      sellerId: "1",
      principalId: "1",
      gameName: "塔防精灵",
      serverName: "测试区",
      assetType: "账号",
      title: "未检测图片",
      description: "测试图片安全记录缺失",
      startingPriceCents: 100,
      minIncrementCents: 100,
      originalEndAt: new Date(Date.now() + 60_000).toISOString(),
      images: [{ objectKey: "uploads/1/untracked.jpg", publicUrl, mimeType: "image/jpeg", sizeBytes: 1024 }]
    });

    await expect(service.assertAssetImagesAllowed(asset.id)).rejects.toMatchObject({
      statusCode: 400,
      code: "image_safety_missing",
      message: "图片未经过上传安全检测，请重新上传后再审核"
    } satisfies Partial<HttpError>);
  });

  it("blocks high-risk image checks with a clear Chinese message", async () => {
    const imageSafetyRepository = createInMemoryImageSafetyRepository();
    const assetsRepository = createInMemoryAssetsRepository();
    const service = createWechatContentSafetyService({
      enabled: true,
      strict: true,
      tokenProvider: { getAccessToken: async () => "token-1" },
      imageSafetyRepository,
      assetsRepository
    });
    const publicUrl = "https://img.example.com/uploads/1/risky.jpg";
    const asset = await assetsRepository.createPending({
      sellerId: "1",
      principalId: "1",
      gameName: "塔防精灵",
      serverName: "测试区",
      assetType: "账号",
      title: "高风险图片",
      description: "测试图片拦截",
      startingPriceCents: 100,
      minIncrementCents: 100,
      originalEndAt: new Date(Date.now() + 60_000).toISOString(),
      images: [{ objectKey: "uploads/1/risky.jpg", publicUrl, mimeType: "image/jpeg", sizeBytes: 1024 }]
    });
    await imageSafetyRepository.record({
      userId: "1",
      objectKey: "uploads/1/risky.jpg",
      publicUrl,
      status: "risky",
      traceId: "image-trace",
      label: 20006
    });

    await expect(service.assertAssetImagesAllowed(asset.id)).rejects.toMatchObject({
      statusCode: 400,
      code: "image_safety_risky",
      message: "图片命中微信内容安全高风险，请更换图片后再审核通过"
    } satisfies Partial<HttpError>);
  });

  it("accepts signed WeChat event callbacks and delegates image check updates", async () => {
    const received: unknown[] = [];
    const app = buildApp({
      enableMockAuth: true,
      env: { WECHAT_EVENT_TOKEN: "event-token" },
      contentSafetyService: {
        async assertTextAllowed() {},
        async requestImageCheck() {
          return { status: "pass" };
        },
        async assertImageUploadsAllowed() {},
        async assertAssetImagesAllowed() {},
        async handleImageCheckCallback(input) {
          received.push(input);
        }
      }
    });
    const timestamp = "1779800000";
    const nonce = "nonce-1";
    const signature = createHash("sha1")
      .update(["event-token", timestamp, nonce].sort().join(""))
      .digest("hex");

    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/wechat/events?signature=${signature}&timestamp=${timestamp}&nonce=${nonce}`,
        payload: { trace_id: "image-trace", result: { suggest: "pass", label: 100 } }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
      expect(received).toEqual([{ trace_id: "image-trace", result: { suggest: "pass", label: 100 } }]);
    } finally {
      await app.close();
    }
  });

  it("accepts signed WeChat XML event callbacks", async () => {
    const received: unknown[] = [];
    const app = buildApp({
      enableMockAuth: true,
      env: { WECHAT_EVENT_TOKEN: "event-token" },
      contentSafetyService: {
        async assertTextAllowed() {},
        async requestImageCheck() {
          return { status: "pass" };
        },
        async assertImageUploadsAllowed() {},
        async assertAssetImagesAllowed() {},
        async handleImageCheckCallback(input) {
          received.push(input);
        }
      }
    });
    const timestamp = "1779800000";
    const nonce = "nonce-xml";
    const signature = createHash("sha1")
      .update(["event-token", timestamp, nonce].sort().join(""))
      .digest("hex");

    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/wechat/events?signature=${signature}&timestamp=${timestamp}&nonce=${nonce}`,
        headers: { "content-type": "text/xml" },
        payload: `<xml><trace_id><![CDATA[image-trace]]></trace_id><result><suggest><![CDATA[pass]]></suggest><label>100</label></result></xml>`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
      expect(received).toEqual([{ trace_id: "image-trace", result: { suggest: "pass", label: 100 } }]);
    } finally {
      await app.close();
    }
  });

  it("passes WeChat XML media download errors to the image safety callback", async () => {
    const received: unknown[] = [];
    const app = buildApp({
      enableMockAuth: true,
      env: { WECHAT_EVENT_TOKEN: "event-token" },
      contentSafetyService: {
        async assertTextAllowed() {},
        async requestImageCheck() {
          return { status: "pass" };
        },
        async assertImageUploadsAllowed() {},
        async assertAssetImagesAllowed() {},
        async handleImageCheckCallback(input) {
          received.push(input);
        }
      }
    });
    const timestamp = "1779800000";
    const nonce = "nonce-xml-error";
    const signature = createHash("sha1")
      .update(["event-token", timestamp, nonce].sort().join(""))
      .digest("hex");

    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/wechat/events?signature=${signature}&timestamp=${timestamp}&nonce=${nonce}`,
        headers: { "content-type": "text/xml" },
        payload: `<xml><trace_id><![CDATA[image-trace]]></trace_id><errcode>-1008</errcode><errmsg><![CDATA[下载错误，请检查媒体链接是否有效]]></errmsg></xml>`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
      expect(received).toEqual([
        {
          trace_id: "image-trace",
          errcode: -1008,
          errmsg: "下载错误，请检查媒体链接是否有效"
        }
      ]);
    } finally {
      await app.close();
    }
  });
});
