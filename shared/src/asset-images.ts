export function firstAssetImageUrl(imageUrls: readonly string[]): string | null {
  for (const imageUrl of imageUrls) {
    const normalized = imageUrl.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}
