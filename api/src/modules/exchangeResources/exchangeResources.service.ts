import {
  dragonBallElementForProfession,
  isDragonBallProfession,
  isDragonBallQuality,
  isWholeYuanCents,
  type DragonBallInfo
} from "@auction/shared";
import { badRequest } from "../../http/errors";
import type { CreateExchangeResourceInput } from "./exchangeResources.repository";

type ExchangeResourceDraftInput = Omit<
  CreateExchangeResourceInput,
  "gameName" | "serverName" | "title" | "desiredExchange" | "description" | "dragonBall" | "dragonBallAmountCents" | "image"
> & {
  gameName?: unknown;
  serverName?: unknown;
  title?: unknown;
  dragonBallAmountCents?: unknown;
  desiredExchange?: unknown;
  description?: unknown;
  dragonBall?: unknown;
  image?: unknown;
};

function requiredString(value: unknown, maxLength: number): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw badRequest("invalid_exchange_resource", "Exchange resource fields are invalid");
  }
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length > maxLength) {
    throw badRequest("invalid_exchange_resource", "Exchange resource fields are invalid");
  }
  return normalized;
}

function normalizeDragonBall(value: unknown): DragonBallInfo {
  if (typeof value !== "object" || value === null) {
    throw badRequest("invalid_exchange_resource", "Exchange resource fields are invalid");
  }
  const input = value as Record<string, unknown>;
  const profession = requiredString(input.profession, 20);
  const quality = requiredString(input.quality, 20);
  const attributes = requiredString(input.attributes, 200);
  const element = dragonBallElementForProfession(profession);
  if (!element || !isDragonBallProfession(profession) || !isDragonBallQuality(quality)) {
    throw badRequest("invalid_exchange_resource", "Exchange resource fields are invalid");
  }
  return { element, profession, quality, attributes };
}

function optionalAmountCents(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (!isWholeYuanCents(value) || value <= 0) {
    throw badRequest("invalid_exchange_resource", "Exchange resource fields are invalid");
  }
  return value;
}

function normalizeImage(value: unknown): CreateExchangeResourceInput["image"] {
  if (Array.isArray(value) || typeof value !== "object" || value === null) {
    throw badRequest("invalid_exchange_resource_image", "Exchange resource image is invalid");
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.objectKey !== "string" ||
    typeof input.publicUrl !== "string" ||
    typeof input.mimeType !== "string" ||
    typeof input.sizeBytes !== "number" ||
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes <= 0
  ) {
    throw badRequest("invalid_exchange_resource_image", "Exchange resource image is invalid");
  }
  const image = {
    objectKey: input.objectKey.trim(),
    publicUrl: input.publicUrl.trim(),
    mimeType: input.mimeType.trim(),
    sizeBytes: input.sizeBytes
  };
  if (!image.objectKey || !image.publicUrl || !image.mimeType) {
    throw badRequest("invalid_exchange_resource_image", "Exchange resource image is invalid");
  }
  return image;
}

export function normalizeExchangeResourceInput(input: ExchangeResourceDraftInput): CreateExchangeResourceInput {
  return {
    publisher: input.publisher,
    gameName: requiredString(input.gameName, 80),
    serverName: optionalString(input.serverName, 80),
    title: requiredString(input.title, 80),
    dragonBall: normalizeDragonBall(input.dragonBall),
    dragonBallAmountCents: optionalAmountCents(input.dragonBallAmountCents),
    image: normalizeImage(input.image),
    desiredExchange: requiredString(input.desiredExchange, 200),
    description: optionalString(input.description, 500),
    status: input.status,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
  };
}

export function exchangeResourceSafetyText(
  input: Pick<CreateExchangeResourceInput, "gameName" | "serverName" | "title" | "desiredExchange" | "description" | "dragonBall" | "dragonBallAmountCents">
): string {
  return [
    input.gameName,
    input.serverName,
    input.title,
    input.dragonBallAmountCents === null ? "" : String(input.dragonBallAmountCents),
    input.desiredExchange,
    input.description,
    input.dragonBall.element,
    input.dragonBall.profession,
    input.dragonBall.quality,
    input.dragonBall.attributes
  ].join("\n");
}
