export type Env = {
  nodeEnv: string;
  host: string;
  port: number;
  jwtSecret: string;
  mysqlUri: string;
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  r2PublicBaseUrl?: string;
  wechatAppId: string;
  wechatAppSecret: string;
  wechatEventToken: string;
  wechatPriceChangeSubscribeTemplateId: string;
  wechatSubscribeMessageMiniprogramState: "developer" | "trial" | "formal";
  corsAllowedOrigins: true | string[];
  contentSafetyEnabled: boolean;
  contentSafetyStrict: boolean;
};

const defaultJwtSecret = "dev-secret-change-me";
const defaultMysqlUri = "mysql://root:password@127.0.0.1:3306/auction_platform";
const defaultProductionCorsAllowedOrigins = ["https://admin-auction.toolmatrix.top", "https://servicewechat.com"];

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
    host: source.HOST ?? "0.0.0.0",
    port,
    jwtSecret: source.JWT_SECRET ?? defaultJwtSecret,
    mysqlUri: source.MYSQL_URI ?? defaultMysqlUri,
    r2Endpoint: source.R2_ENDPOINT ?? "",
    r2AccessKeyId: source.R2_ACCESS_KEY_ID ?? "",
    r2SecretAccessKey: source.R2_SECRET_ACCESS_KEY ?? "",
    r2Bucket: source.R2_BUCKET ?? "auction-assets",
    r2PublicBaseUrl: source.R2_PUBLIC_BASE_URL?.trim() || undefined,
    wechatAppId: source.WECHAT_APPID ?? "",
    wechatAppSecret: source.WECHAT_APP_SECRET ?? "",
    wechatEventToken: source.WECHAT_EVENT_TOKEN ?? "",
    wechatPriceChangeSubscribeTemplateId: source.WECHAT_PRICE_CHANGE_SUBSCRIBE_TEMPLATE_ID?.trim() ?? "",
    wechatSubscribeMessageMiniprogramState: readMiniprogramState(source.WECHAT_SUBSCRIBE_MESSAGE_MINIPROGRAM_STATE, nodeEnv),
    corsAllowedOrigins: readCorsAllowedOrigins(source.CORS_ALLOWED_ORIGINS, nodeEnv),
    contentSafetyEnabled,
    contentSafetyStrict
  };
}
