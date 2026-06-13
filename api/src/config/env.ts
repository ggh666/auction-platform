export type Env = {
  nodeEnv: string;
  logLevel: LogLevel;
  host: string;
  port: number;
  apiPublicBaseUrl: string;
  apiSlowRequestThresholdMs: number;
  jwtSecret: string;
  mysqlUri: string;
  mysqlConnectionLimit: number;
  mysqlMaxIdle: number;
  mysqlIdleTimeoutMs: number;
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  r2PublicBaseUrl?: string;
  wechatAppId: string;
  wechatAppSecret: string;
  wechatEventToken: string;
  wechatPriceChangeSubscribeTemplateId: string;
  wechatAssetMessageSubscribeTemplateId: string;
  wechatSubscribeMessageMiniprogramState: "developer" | "trial" | "formal";
  corsAllowedOrigins: true | string[];
  contentSafetyEnabled: boolean;
  contentSafetyStrict: boolean;
};

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const defaultJwtSecret = "dev-secret-change-me";
const defaultMysqlUri = "mysql://root:password@127.0.0.1:3306/auction_platform";
const defaultProductionCorsAllowedOrigins = ["https://admin-auction.toolmatrix.top", "https://servicewechat.com"];
const supportedLogLevels = new Set<LogLevel>(["trace", "debug", "info", "warn", "error", "fatal"]);

function readMiniprogramState(value: string | undefined, nodeEnv: string): "developer" | "trial" | "formal" {
  if (value === undefined || !value.trim()) {
    return nodeEnv === "production" ? "formal" : "developer";
  }
  if (value === "developer" || value === "trial" || value === "formal") {
    return value;
  }
  throw new Error("Invalid WECHAT_SUBSCRIBE_MESSAGE_MINIPROGRAM_STATE");
}

function readCorsAllowedOrigins(value: string | undefined, nodeEnv: string): true | string[] {
  const configured = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) {
    return configured;
  }
  return nodeEnv === "production" ? defaultProductionCorsAllowedOrigins : true;
}

function readLogLevel(value: string | undefined): LogLevel {
  if (value === undefined || !value.trim()) {
    return "warn";
  }
  const normalized = value.trim().toLowerCase();
  if (supportedLogLevels.has(normalized as LogLevel)) {
    return normalized as LogLevel;
  }
  throw new Error("Invalid LOG_LEVEL");
}

function readPositiveIntegerEnv(name: string, value: string | undefined, defaultValue: number): number {
  if (value === undefined || !value.trim()) {
    return defaultValue;
  }
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new Error(`Invalid ${name}`);
  }
  return normalized;
}

function defaultApiPublicBaseUrl(nodeEnv: string, port: number): string {
  return nodeEnv === "production" ? "https://api-auction.toolmatrix.top" : `http://127.0.0.1:${port}`;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const port = Number(source.PORT ?? 3002);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid PORT");
  }

  const nodeEnv = source.NODE_ENV ?? "development";
  const contentSafetyEnabled =
    source.CONTENT_SAFETY_ENABLED === undefined ? nodeEnv === "production" : source.CONTENT_SAFETY_ENABLED !== "false";
  const contentSafetyStrict =
    source.CONTENT_SAFETY_STRICT === undefined ? true : source.CONTENT_SAFETY_STRICT !== "false";
  const mysqlConnectionLimit = readPositiveIntegerEnv("MYSQL_CONNECTION_LIMIT", source.MYSQL_CONNECTION_LIMIT, 10);
  const mysqlMaxIdle = readPositiveIntegerEnv("MYSQL_MAX_IDLE", source.MYSQL_MAX_IDLE, Math.min(2, mysqlConnectionLimit));
  if (mysqlMaxIdle > mysqlConnectionLimit) {
    throw new Error("Invalid MYSQL_MAX_IDLE");
  }
  const mysqlIdleTimeoutMs = readPositiveIntegerEnv("MYSQL_IDLE_TIMEOUT_MS", source.MYSQL_IDLE_TIMEOUT_MS, 60000);
  const apiSlowRequestThresholdMs = readPositiveIntegerEnv(
    "API_SLOW_REQUEST_THRESHOLD_MS",
    source.API_SLOW_REQUEST_THRESHOLD_MS,
    800
  );

  if (nodeEnv === "production") {
    if (!contentSafetyEnabled) {
      throw new Error("CONTENT_SAFETY_ENABLED must be true in production");
    }
    if (!contentSafetyStrict) {
      throw new Error("CONTENT_SAFETY_STRICT must be true in production");
    }

    const requiredNames = [
      "JWT_SECRET",
      "MYSQL_URI",
      "R2_ENDPOINT",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
      "WECHAT_APPID",
      "WECHAT_APP_SECRET"
    ];
    if (contentSafetyEnabled) {
      requiredNames.push("WECHAT_EVENT_TOKEN");
    }
    for (const name of requiredNames) {
      if (!source[name]?.trim()) {
        throw new Error(`Missing required production environment variable: ${name}`);
      }
    }
    if (source.JWT_SECRET?.trim() === defaultJwtSecret) {
      throw new Error("Unsafe production environment variable: JWT_SECRET");
    }
    if (source.MYSQL_URI?.trim() === defaultMysqlUri) {
      throw new Error("Unsafe production environment variable: MYSQL_URI");
    }
  }

  return {
    nodeEnv,
    logLevel: readLogLevel(source.LOG_LEVEL),
    host: source.HOST ?? "0.0.0.0",
    port,
    apiPublicBaseUrl: source.API_PUBLIC_BASE_URL?.trim() || defaultApiPublicBaseUrl(nodeEnv, port),
    apiSlowRequestThresholdMs,
    jwtSecret: source.JWT_SECRET ?? defaultJwtSecret,
    mysqlUri: source.MYSQL_URI ?? defaultMysqlUri,
    mysqlConnectionLimit,
    mysqlMaxIdle,
    mysqlIdleTimeoutMs,
    r2Endpoint: source.R2_ENDPOINT ?? "",
    r2AccessKeyId: source.R2_ACCESS_KEY_ID ?? "",
    r2SecretAccessKey: source.R2_SECRET_ACCESS_KEY ?? "",
    r2Bucket: source.R2_BUCKET ?? "auction-assets",
    r2PublicBaseUrl: source.R2_PUBLIC_BASE_URL?.trim() || undefined,
    wechatAppId: source.WECHAT_APPID ?? "",
    wechatAppSecret: source.WECHAT_APP_SECRET ?? "",
    wechatEventToken: source.WECHAT_EVENT_TOKEN ?? "",
    wechatPriceChangeSubscribeTemplateId: source.WECHAT_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID?.trim() ?? "",
    wechatAssetMessageSubscribeTemplateId: source.WECHAT_ASSET_MESSAGE_SUBSCRIBE_TEMPLATE_ID?.trim() ?? "",
    wechatSubscribeMessageMiniprogramState: readMiniprogramState(source.WECHAT_SUBSCRIBE_MESSAGE_MINIPROGRAM_STATE, nodeEnv),
    corsAllowedOrigins: readCorsAllowedOrigins(source.CORS_ALLOWED_ORIGINS, nodeEnv),
    contentSafetyEnabled,
    contentSafetyStrict
  };
}
