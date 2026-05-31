const MONEY_PATTERN = /^(0|[1-9]\d*)$/;

export function parseYuanToCents(input: string): number {
  const trimmed = input.trim();
  if (!MONEY_PATTERN.test(trimmed)) {
    throw new Error("Invalid amount");
  }

  const totalCents = BigInt(trimmed) * 100n;
  if (totalCents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Invalid amount");
  }

  return Number(totalCents);
}

export function isWholeYuanCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value % 100 === 0;
}

export function centsToYuanText(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("Invalid amount");
  }
  return String(Math.floor(cents / 100));
}
