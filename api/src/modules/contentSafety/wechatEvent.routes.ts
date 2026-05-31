import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Env } from "../../config/env";
import { forbidden } from "../../http/errors";
import type { ContentSafetyService } from "./contentSafety.service";

type WechatEventQuery = {
  signature?: unknown;
  timestamp?: unknown;
  nonce?: unknown;
  echostr?: unknown;
};

function stringQuery(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function signatureFor(token: string, timestamp: string, nonce: string): string {
  return createHash("sha1").update([token, timestamp, nonce].sort().join("")).digest("hex");
}

function isValidSignature(query: WechatEventQuery, token: string): boolean {
  if (!token) {
    return true;
  }
  const signature = stringQuery(query.signature);
  const timestamp = stringQuery(query.timestamp);
  const nonce = stringQuery(query.nonce);
  if (!signature || !timestamp || !nonce) {
    return false;
  }
  const expected = signatureFor(token, timestamp, nonce);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function decodeXmlText(value: string): string {
  return value
    .trim()
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlValue(xml: string, tagName: string): string | undefined {
  const match = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, "i").exec(xml);
  return match ? decodeXmlText(match[1]) : undefined;
}

function parseWechatXmlEvent(xml: string): unknown {
  const traceId = xmlValue(xml, "trace_id") ?? xmlValue(xml, "traceId") ?? xmlValue(xml, "TraceId");
  const suggest = xmlValue(xml, "suggest") ?? xmlValue(xml, "Suggest");
  const labelValue = xmlValue(xml, "label") ?? xmlValue(xml, "Label");
  const label = labelValue === undefined || Number.isNaN(Number(labelValue)) ? undefined : Number(labelValue);
  const errcodeValue = xmlValue(xml, "errcode") ?? xmlValue(xml, "ErrCode");
  const errcode = errcodeValue === undefined || Number.isNaN(Number(errcodeValue)) ? undefined : Number(errcodeValue);
  const errmsg = xmlValue(xml, "errmsg") ?? xmlValue(xml, "ErrMsg");
  const event: Record<string, unknown> = {
    trace_id: traceId
  };
  if (suggest !== undefined || label !== undefined) {
    event.result = {
      suggest,
      label
    };
  }
  if (errcode !== undefined) {
    event.errcode = errcode;
  }
  if (errmsg !== undefined) {
    event.errmsg = errmsg;
  }
  return event;
}

export function registerWechatEventRoutes(
  app: FastifyInstance,
  contentSafety: ContentSafetyService,
  env: Pick<Env, "wechatEventToken">
): void {
  app.addContentTypeParser(["text/xml", "application/xml"], { parseAs: "string" }, (_request, body, done) => {
    const rawBody = typeof body === "string" ? body : body.toString("utf8");
    done(null, parseWechatXmlEvent(rawBody));
  });

  app.get<{ Querystring: WechatEventQuery }>("/api/wechat/events", async (request, reply) => {
    if (!isValidSignature(request.query, env.wechatEventToken)) {
      throw forbidden("invalid_wechat_signature", "Invalid WeChat signature");
    }
    return reply.type("text/plain").send(stringQuery(request.query.echostr));
  });

  app.post<{ Querystring: WechatEventQuery; Body: unknown }>("/api/wechat/events", async (request) => {
    if (!isValidSignature(request.query, env.wechatEventToken)) {
      throw forbidden("invalid_wechat_signature", "Invalid WeChat signature");
    }
    await contentSafety.handleImageCheckCallback?.(request.body);
    return { ok: true };
  });
}
