const MONEY_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

export function parseYuanToCents(input: string): number {
  const trimmed = input.trim();
  if (!MONEY_PATTERN.test(trimmed)) {
    throw new Error("Invalid amount");
  }

  const [yuan, decimal = ""] = trimmed.split(".");
  const cents = `${decimal}00`.slice(0, 2);
  const totalCents = BigInt(yuan) * 100n + BigInt(cents);
  if (totalCents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Invalid amount");
  }

  return Number(totalCents);
}

export function centsToYuanText(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("Invalid amount");
  }
  const yuan = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `${yuan}.${rest}`;
}
