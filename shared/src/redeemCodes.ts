export type RedeemCodeItem = {
  code: string;
  description: string;
  validity: string;
};

const maxCodeLength = 64;
const maxDescriptionLength = 120;
const maxValidityLength = 40;

export class RedeemCodeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedeemCodeParseError";
  }
}

function parseLine(line: string, lineNumber: number): RedeemCodeItem | null {
  if (!line.trim()) {
    return null;
  }

  const parts = line.split("|").map((part) => part.trim());
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new RedeemCodeParseError(`第 ${lineNumber} 行必须使用「兑换码|奖励说明|效期」格式`);
  }

  const [code, description, validity] = parts;
  if (code.length > maxCodeLength) {
    throw new RedeemCodeParseError(`第 ${lineNumber} 行兑换码过长`);
  }
  if (description.length > maxDescriptionLength) {
    throw new RedeemCodeParseError(`第 ${lineNumber} 行奖励说明过长`);
  }
  if (validity.length > maxValidityLength) {
    throw new RedeemCodeParseError(`第 ${lineNumber} 行效期过长`);
  }

  return { code, description, validity };
}

export function parseRedeemCodeText(rawText: string): RedeemCodeItem[] {
  const items: RedeemCodeItem[] = [];
  const seenCodes = new Set<string>();
  const lines = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  lines.forEach((line, index) => {
    const item = parseLine(line, index + 1);
    if (!item) {
      return;
    }
    if (seenCodes.has(item.code)) {
      throw new RedeemCodeParseError(`第 ${index + 1} 行兑换码重复`);
    }
    seenCodes.add(item.code);
    items.push(item);
  });

  return items;
}
