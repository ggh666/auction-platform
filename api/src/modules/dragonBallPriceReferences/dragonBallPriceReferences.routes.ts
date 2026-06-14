import type {
  DragonBallPriceReferenceBatchListResponse,
  DragonBallPriceReferenceBatchResponse,
  DragonBallPriceReferenceBatchUpsertRequest,
  DragonBallPriceReferenceLatestResponse,
  DragonBallPriceReferenceTrendResponse,
  DragonBallPriceReferenceProfession,
  DragonBallQuality
} from "@auction/shared";
import { isDragonBallPriceReferenceProfession, isDragonBallQuality } from "@auction/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../http/auth";
import { badRequest, notFound } from "../../http/errors";
import type { AdminRepository } from "../admin/admin.repository";
import { readPagination, type PageQuery } from "../admin/pagination";
import type { DragonBallPriceReferencesRepository } from "./dragonBallPriceReferences.repository";
import {
  normalizeDragonBallPriceReferenceBatchInput,
  readPriceReferenceGameName,
  readPriceReferenceLimit
} from "./dragonBallPriceReferences.service";

type LatestQuery = {
  gameName?: unknown;
};

type TrendQuery = LatestQuery & {
  profession?: unknown;
  quality?: unknown;
  limit?: unknown;
};

function readProfession(value: unknown): DragonBallPriceReferenceProfession {
  const profession = typeof value === "string" ? value.trim() : "";
  if (!isDragonBallPriceReferenceProfession(profession)) {
    throw badRequest("invalid_price_reference_item", "Price reference profession is invalid");
  }
  return profession;
}

function readQuality(value: unknown): DragonBallQuality {
  const quality = typeof value === "string" ? value.trim() : "";
  if (!isDragonBallQuality(quality)) {
    throw badRequest("invalid_price_reference_item", "Price reference quality is invalid");
  }
  return quality;
}

export function registerDragonBallPriceReferenceRoutes(
  app: FastifyInstance,
  deps: {
    admins: AdminRepository;
    priceReferences: DragonBallPriceReferencesRepository;
  }
): void {
  app.get<{ Querystring: LatestQuery; Reply: DragonBallPriceReferenceLatestResponse }>(
    "/api/dragon-ball-price-references/latest",
    async (request) => ({
      batch: await deps.priceReferences.latest(readPriceReferenceGameName(request.query.gameName))
    })
  );

  app.get<{ Querystring: TrendQuery; Reply: DragonBallPriceReferenceTrendResponse }>(
    "/api/dragon-ball-price-references/trend",
    async (request) => ({
      items: await deps.priceReferences.trend({
        gameName: readPriceReferenceGameName(request.query.gameName),
        profession: readProfession(request.query.profession),
        quality: readQuality(request.query.quality),
        limit: readPriceReferenceLimit(request.query.limit)
      })
    })
  );

  app.get<{ Querystring: PageQuery; Reply: DragonBallPriceReferenceBatchListResponse }>(
    "/admin/dragon-ball-price-reference-batches",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async (request) => deps.priceReferences.listBatches(readPagination(request.query))
  );

  app.post<{ Body: DragonBallPriceReferenceBatchUpsertRequest; Reply: DragonBallPriceReferenceBatchResponse }>(
    "/admin/dragon-ball-price-reference-batches",
    { preHandler: requireAdmin("asset:create", deps.admins) },
    async (request) => ({
      batch: await deps.priceReferences.upsertBatch(normalizeDragonBallPriceReferenceBatchInput(request.body))
    })
  );

  app.get<{ Params: { batchId: string }; Reply: DragonBallPriceReferenceBatchResponse }>(
    "/admin/dragon-ball-price-reference-batches/:batchId",
    { preHandler: requireAdmin("asset:view", deps.admins) },
    async (request) => {
      const batch = await deps.priceReferences.findBatchById(request.params.batchId);
      if (!batch) {
        throw notFound("price_reference_batch_not_found", "Price reference batch not found");
      }
      return { batch };
    }
  );

  app.put<{ Params: { batchId: string }; Body: DragonBallPriceReferenceBatchUpsertRequest; Reply: DragonBallPriceReferenceBatchResponse }>(
    "/admin/dragon-ball-price-reference-batches/:batchId",
    { preHandler: requireAdmin("asset:create", deps.admins) },
    async (request) => {
      const batch = await deps.priceReferences.updateBatch(
        request.params.batchId,
        normalizeDragonBallPriceReferenceBatchInput(request.body)
      );
      if (!batch) {
        throw notFound("price_reference_batch_not_found", "Price reference batch not found");
      }
      return { batch };
    }
  );

  app.delete<{ Params: { batchId: string }; Reply: DragonBallPriceReferenceBatchResponse }>(
    "/admin/dragon-ball-price-reference-batches/:batchId",
    { preHandler: requireAdmin("asset:create", deps.admins) },
    async (request) => {
      const batch = await deps.priceReferences.deleteBatch(request.params.batchId);
      if (!batch) {
        throw notFound("price_reference_batch_not_found", "Price reference batch not found");
      }
      return { batch };
    }
  );
}
