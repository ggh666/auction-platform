export const gameOptions = ["塔防精灵"] as const;
export type GameName = (typeof gameOptions)[number];
export const defaultGameName: GameName = "塔防精灵";

export function normalizeGameName(value: unknown): GameName | null {
  if (typeof value !== "string") {
    return null;
  }

  const decoded = decodeQueryValue(value).trim();
  return gameOptions.find((gameName) => gameName === decoded) ?? null;
}

function decodeQueryValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
