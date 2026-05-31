import { describe, expect, it } from "vitest";
import {
  decodeImageCheckDetail,
  isWechatMediaDownloadFailure,
  nextRetryAttemptForImageCheck,
  retryOpenidForImageCheck
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
});
