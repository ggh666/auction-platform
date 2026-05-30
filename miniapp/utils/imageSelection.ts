export const MAX_ASSET_IMAGES = 9;

export type AppendAssetImagePathsResult = {
  paths: string[];
  rejectedCount: number;
};

export function appendAssetImagePaths(
  currentPaths: readonly string[],
  selectedPaths: readonly string[],
  maxImages = MAX_ASSET_IMAGES
): AppendAssetImagePathsResult {
  const remaining = Math.max(0, maxImages - currentPaths.length);
  const accepted = selectedPaths.slice(0, remaining);
  return {
    paths: [...currentPaths, ...accepted],
    rejectedCount: Math.max(0, selectedPaths.length - accepted.length)
  };
}

export function removeAssetImagePathAt(paths: readonly string[], index: number): string[] {
  if (!Number.isInteger(index) || index < 0 || index >= paths.length) {
    return [...paths];
  }

  return paths.filter((_path, currentIndex) => currentIndex !== index);
}
