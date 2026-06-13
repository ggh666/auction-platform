import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type RequestLike = {
  id?: unknown;
  method: string;
  url: string;
  routeOptions?: {
    url?: string;
  };
};

type ReplyLike = {
  statusCode: number;
};

type TimingLogPayload = {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  slow: boolean;
};

type RequestTimingLog = {
  info(payload: TimingLogPayload, message: string): void;
  warn(payload: TimingLogPayload, message: string): void;
};

export type RequestTimingOptions = {
  slowRequestThresholdMs: number;
  now?: () => number;
  log: RequestTimingLog;
};

function routeForRequest(request: RequestLike): string {
  const routeUrl = request.routeOptions?.url?.trim();
  if (routeUrl) {
    return routeUrl;
  }
  const queryIndex = request.url.indexOf("?");
  return queryIndex >= 0 ? request.url.slice(0, queryIndex) : request.url;
}

function requestIdFor(request: RequestLike): string {
  return typeof request.id === "string" ? request.id : String(request.id ?? "");
}

export function createRequestTimingHooks(options: RequestTimingOptions) {
  const now = options.now ?? Date.now;
  const startedAtByRequest = new Map<string, number>();

  return {
    onRequest(request: RequestLike): void {
      startedAtByRequest.set(requestIdFor(request), now());
    },
    onResponse(request: RequestLike, reply: ReplyLike): void {
      const requestId = requestIdFor(request);
      const startedAt = startedAtByRequest.get(requestId) ?? now();
      startedAtByRequest.delete(requestId);
      const durationMs = Math.max(0, Math.round(now() - startedAt));
      const slow = durationMs >= options.slowRequestThresholdMs;
      const payload: TimingLogPayload = {
        requestId,
        method: request.method,
        route: routeForRequest(request),
        statusCode: reply.statusCode,
        durationMs,
        slow
      };
      if (slow) {
        options.log.warn(payload, "api_request_slow");
        return;
      }
      options.log.info(payload, "api_request_completed");
    }
  };
}

export function registerRequestTiming(app: FastifyInstance, options: Pick<RequestTimingOptions, "slowRequestThresholdMs">): void {
  const hooks = createRequestTimingHooks({
    slowRequestThresholdMs: options.slowRequestThresholdMs,
    log: {
      info(payload, message) {
        app.log.info(payload, message);
      },
      warn(payload, message) {
        app.log.warn(payload, message);
      }
    }
  });

  app.addHook("onRequest", (request: FastifyRequest, _reply: FastifyReply, done) => {
    hooks.onRequest(request);
    done();
  });
  app.addHook("onResponse", (request: FastifyRequest, reply: FastifyReply, done) => {
    hooks.onResponse(request, reply);
    done();
  });
}
