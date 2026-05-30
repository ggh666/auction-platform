import { describe, expect, it } from "vitest";
import { appendAssetImagePaths, removeAssetImagePathAt } from "./imageSelection";

describe("miniapp asset image selection", () => {
  it("appends selected images up to the asset image limit", () => {
    const existing = Array.from({ length: 8 }, (_, index) => `/tmp/existing-${index}.jpg`);

    expect(appendAssetImagePaths(existing, ["/tmp/new-1.jpg", "/tmp/new-2.jpg"])).toEqual({
      paths: [...existing, "/tmp/new-1.jpg"],
      rejectedCount: 1
    });
  });

  it("removes a selected image by index so another image can be chosen", () => {
    expect(removeAssetImagePathAt(["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"], 1)).toEqual(["/tmp/a.jpg", "/tmp/c.jpg"]);
  });

  it("keeps the current selection when removing an invalid index", () => {
    const paths = ["/tmp/a.jpg", "/tmp/b.jpg"];

    expect(removeAssetImagePathAt(paths, 9)).toEqual(paths);
  });
});
