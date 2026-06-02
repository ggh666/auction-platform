import { describe, expect, it } from "vitest";
import {
  decodeImageCheckDetail,
  isWechatMediaDownloadFailure,
  mediaCheckDetailForImageCheck,
  nextRetryAttemptForImageCheck,
  retryOpenidForImageCheck,
  wechatMediaCheckUrlForImageCheck
} from "../../api/src/scripts/retryFailedImageChecks";

describe("retry failed image checks script helpers", () => {
  it("detects WeChat media download failures from stored detail JSON", () => {
    expect(isWechatMediaDownloadFailure(decodeImageCheckDetail('{"errcode":-1008,"errmsg":"下载错误"}'))).toBe(true);
    expect(isWechatMediaDownloadFailure(decodeImageCheckDetail('{"errcode":0}'))).toBe(false);
  });

  it("falls back to WeChat callback FromUserName when user openid is missing", () => {
    expect(
      retryOpenidForImageCheck({
        user_openid: null,
        detail_json: {
          FromUserName: "callback-openid"
        }
      })
    ).toBe("callback-openid");
  });

  it("uses the next retry attempt after previous retry metadata", () => {
    expect(nextRetryAttemptForImageCheck({ retry: { attempt: 2 } })).toBe(3);
    expect(nextRetryAttemptForImageCheck({ retryFailure: { attempt: 1 } })).toBe(2);
    expect(nextRetryAttemptForImageCheck({ errcode: -1008 })).toBe(1);
  });

  it("uses the backend proxy URL when manually retrying WeChat image checks", () => {
    const url = wechatMediaCheckUrlForImageCheck({
      apiPublicBaseUrl: "https://api.example.com",
      jwtSecret: "test-secret",
      objectKey: "uploads/accounts/1/a.jpg",
      nowMs: 1779800000000
    });

    expect(url).toMatch(/^https:\/\/api\.example\.com\/api\/wechat\/media-check-image\/.+/);
    expect(url).not.toContain("auction-pic.example.com");
  });

  it("records backend proxy diagnostics for manually retried image checks", () => {
    expect(
      mediaCheckDetailForImageCheck(
        "https://auction-pic.example.com/uploads/accounts/1/a.jpg",
        "https://api.example.com/api/wechat/media-check-image/signed-token"
      )
    ).toEqual({
      submittedUrlType: "backend_proxy",
      submittedHost: "api.example.com",
      submittedPath: "/api/wechat/media-check-image/*"
    });
  });
});
