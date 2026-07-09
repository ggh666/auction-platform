import {
  dragonBallPriceReferenceProfessionOptions,
  dragonBallQualityOptions,
  type DragonBallPriceReferenceProfession,
  type DragonBallQuality
} from "@auction/shared";

export type PriceReferenceImportEntry = {
  profession: DragonBallPriceReferenceProfession;
  quality: DragonBallQuality;
  minPriceYuan: string;
};

export type PriceReferenceImportResult = {
  entries: PriceReferenceImportEntry[];
  errors: string[];
};

const positiveIntegerPattern = /^[1-9]\d*$/;

function normalizeQuality(value: string): DragonBallQuality | null {
  const normalized = value.trim().replace(/色/g, "").replace(/品质/g, "");
  return dragonBallQualityOptions.includes(normalized as DragonBallQuality) ? (normalized as DragonBallQuality) : null;
}

function normalizeProfession(value: string): DragonBallPriceReferenceProfession | null {
  const normalized = value.trim();
  return dragonBallPriceReferenceProfessionOptions.includes(normalized as DragonBallPriceReferenceProfession)
    ? (normalized as DragonBallPriceReferenceProfession)
    : null;
}

function readPrice(value: string): string | null {
  const normalized = value.trim().replace(/元宝/g, "");
  return positiveIntegerPattern.test(normalized) ? normalized : null;
}

function parseProfessionQuality(
  first: string,
  second: string
): Pick<PriceReferenceImportEntry, "profession" | "quality"> | null {
  const firstProfession = normalizeProfession(first);
  const secondQuality = normalizeQuality(second);
  if (firstProfession && secondQuality) {
    return { profession: firstProfession, quality: secondQuality };
  }

  const firstQuality = normalizeQuality(first);
  const secondProfession = normalizeProfession(second);
  if (firstQuality && secondProfession) {
    return { profession: secondProfession, quality: firstQuality };
  }

  return null;
}

function parseCompactProfessionQuality(value: string): Pick<PriceReferenceImportEntry, "profession" | "quality"> | null {
  const normalized = value.trim().replace(/\s+/g, "");
  for (const quality of dragonBallQualityOptions) {
    const qualityLabels = [quality, `${quality}色`, `${quality}品质`, `${quality}色品质`];
    for (const profession of dragonBallPriceReferenceProfessionOptions) {
      if (qualityLabels.some((label) => normalized === `${label}${profession}` || normalized === `${profession}${label}`)) {
        return { profession, quality };
      }
    }
  }
  return null;
}

function isHeaderLine(line: string): boolean {
  return line.includes("职业") && line.includes("品质") && (line.includes("低价") || line.includes("起拍价"));
}

function parseLine(line: string): PriceReferenceImportEntry | string | null {
  const trimmed = line.trim();
  if (!trimmed || isHeaderLine(trimmed)) {
    return null;
  }

  const commaParts = trimmed
    .split(/[,\t，]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (commaParts.length >= 3) {
    const professionQuality = parseProfessionQuality(commaParts[0], commaParts[1]);
    if (!professionQuality) {
      return "无法识别职业/品质";
    }
    const minPriceYuan = readPrice(commaParts[2]);
    if (!minPriceYuan) {
      return "低价必须是正整数";
    }
    return { ...professionQuality, minPriceYuan };
  }

  const spaceParts = trimmed
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (spaceParts.length >= 3) {
    const minPriceYuan = readPrice(spaceParts[spaceParts.length - 1]);
    if (!minPriceYuan) {
      return "低价必须是正整数";
    }
    const professionQuality = parseProfessionQuality(spaceParts[0], spaceParts[1]);
    if (professionQuality) {
      return { ...professionQuality, minPriceYuan };
    }
    const compact = parseCompactProfessionQuality(spaceParts.slice(0, -1).join(""));
    return compact ? { ...compact, minPriceYuan } : "无法识别职业/品质";
  }

  if (spaceParts.length === 2) {
    const minPriceYuan = readPrice(spaceParts[1]);
    if (!minPriceYuan) {
      return "低价必须是正整数";
    }
    const compact = parseCompactProfessionQuality(spaceParts[0]);
    return compact ? { ...compact, minPriceYuan } : "无法识别职业/品质";
  }

  return "无法识别职业/品质";
}

export function parsePriceReferenceImportText(text: string): PriceReferenceImportResult {
  const entries: PriceReferenceImportEntry[] = [];
  const errors: string[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    const parsed = parseLine(line);
    if (!parsed) {
      return;
    }
    if (typeof parsed === "string") {
      errors.push(`第 ${index + 1} 行${parsed}：${line.trim()}`);
      return;
    }
    entries.push(parsed);
  });

  return errors.length > 0 ? { entries: [], errors } : { entries, errors };
}
