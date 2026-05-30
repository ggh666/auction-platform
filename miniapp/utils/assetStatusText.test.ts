import { describe, expect, it } from "vitest";
import { assetStatusText } from "./assetStatusText";

describe("miniapp asset status text", () => {
  it("maps asset review and lifecycle statuses to Chinese labels", () => {
    expect(assetStatusText("draft")).toBe("草稿");
    expect(assetStatusText("pending_review")).toBe("审核中");
    expect(assetStatusText("active")).toBe("已上架");
    expect(assetStatusText("ended")).toBe("已结束");
    expect(assetStatusText("rejected")).toBe("已驳回");
    expect(assetStatusText("cancelled")).toBe("已取消");
    expect(assetStatusText("removed")).toBe("已下架");
  });
});
