import { describe, expect, it } from "vitest";
import { detectImageMimeType, imageExtensionForMimeType } from "./imageMime";

describe("image MIME detection", () => {
  it("detects PNG from file bytes instead of the file name", () => {
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

    expect(detectImageMimeType(pngBase64)).toBe("image/png");
    expect(imageExtensionForMimeType("image/png")).toBe("png");
  });

  it("detects JPEG from file bytes", () => {
    const jpegBase64 = "/9j/4AAQSkZJRgABAQAAAQABAAD";

    expect(detectImageMimeType(jpegBase64)).toBe("image/jpeg");
    expect(imageExtensionForMimeType("image/jpeg")).toBe("jpg");
  });

  it("detects WebP from RIFF WEBP file bytes", () => {
    const webpBase64 = "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

    expect(detectImageMimeType(webpBase64)).toBe("image/webp");
    expect(imageExtensionForMimeType("image/webp")).toBe("webp");
  });

  it("returns null for unsupported or invalid image data", () => {
    expect(detectImageMimeType("bm90LWFuLWltYWdl")).toBeNull();
    expect(detectImageMimeType("")).toBeNull();
  });
});
