import {
  isDragonBallPriceReferenceProfession,
  isDragonBallQuality,
  isWholeYuanCents,
  type DragonBallPriceReferenceBatchUpsertRequest
} from "@auction/shared";
import { badRequest } from "../../http/errors";
import type { DragonBallPriceReferenceBatchInput } from "./dragonBallPriceReferences.repository";

const weekStartDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function requiredString(value: unknown, maxLength: number, code: string, message: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw badRequest(code, message);
  }
  return normalized;
}

function optionalString(value: unknown, maxLength: number, code: string, message: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length > maxLength) {
    throw badRequest(code, message);
  }
  return normalized;
}

function readDateOnly(value: unknown): string {
  const raw = requiredString(value, 10, "invalid_price_reference_week", "Price reference week is invalid");
  if (!weekStartDatePattern.test(raw)) {
    throw badRequest("invalid_price_reference_week", "Price reference week is invalid");
  }
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw badRequest("invalid_price_reference_week", "Price reference week is invalid");
  }
  return raw;
}

function addDays(dateText: string, days: number): string {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function normalizeReferenceItems(items: unknown): DragonBallPriceReferenceBatchInput["items"] {
  if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
    throw badRequest("invalid_price_reference_item", "Price reference rows are invalid");
  }

  return items.map((rawItem) => {
    if (typeof rawItem !== "object" || rawItem === null) {
      throw badRequest("invalid_price_reference_item", "Price reference rows are invalid");
    }
    const input = rawItem as Record<string, unknown>;
    const profession = requiredString(input.profession, 20, "invalid_price_reference_item", "Price reference row is invalid");
    const quality = requiredString(input.quality, 20, "invalid_price_reference_item", "Price reference row is invalid");
    if (!isDragonBallPriceReferenceProfession(profession) || !isDragonBallQuality(quality)) {
      throw badRequest("invalid_price_reference_item", "Price reference row is invalid");
    }
    if (
      !isWholeYuanCents(input.minPriceCents) ||
      !isWholeYuanCents(input.maxPriceCents) ||
      input.minPriceCents <= 0 ||
      input.maxPriceCents <= 0
    ) {
      throw badRequest("invalid_price_reference_price", "Price reference price must be a positive whole yuan amount");
    }
    if (input.minPriceCents > input.maxPriceCents) {
      throw badRequest("invalid_price_reference_range", "Minimum price cannot exceed maximum price");
    }
    return {
      profession,
      quality,
      minPriceCents: input.minPriceCents,
      maxPriceCents: input.maxPriceCents
    };
  });
}

export function normalizeDragonBallPriceReferenceBatchInput(
  input: DragonBallPriceReferenceBatchUpsertRequest
): DragonBallPriceReferenceBatchInput {
  const weekStartDate = readDateOnly(input?.weekStartDate);
  return {
    gameName: requiredString(input?.gameName, 80, "invalid_price_reference_batch", "Price reference batch is invalid"),
    weekStartDate,
    weekEndDate: addDays(weekStartDate, 6),
    note: optionalString(input?.note, 200, "invalid_price_reference_batch", "Price reference batch is invalid"),
    items: normalizeReferenceItems(input?.items)
  };
}

export function readPriceReferenceGameName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "塔防精灵";
}

export function readPriceReferenceLimit(value: unknown): number | undefined {
  const raw = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, 52) : undefined;
}
