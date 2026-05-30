export type SupportedImageMimeType = "image/jpeg" | "image/png" | "image/webp";

const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function normalizeBase64(value: string): string {
  const commaIndex = value.indexOf(",");
  const payload = commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
  return payload.replace(/\s/g, "");
}

function decodeBase64Prefix(value: string, maxBytes: number): number[] {
  const normalized = normalizeBase64(value);
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of normalized) {
    if (char === "=") {
      break;
    }

    const digit = base64Alphabet.indexOf(char);
    if (digit < 0) {
      return [];
    }

    buffer = (buffer << 6) | digit;
    bits += 6;

    while (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      if (bytes.length >= maxBytes) {
        return bytes;
      }
    }
  }

  return bytes;
}

export function detectImageMimeType(base64Data: string): SupportedImageMimeType | null {
  if (!base64Data.trim()) {
    return null;
  }

  const bytes = decodeBase64Prefix(base64Data, 16);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) {
    return "image/png";
  }

  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isWebp) {
    return "image/webp";
  }

  return null;
}

export function imageExtensionForMimeType(mimeType: SupportedImageMimeType): string {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  return "webp";
}
