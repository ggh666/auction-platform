import mysql from "mysql2/promise";
import { readEnv } from "../config/env";
import type { MysqlPool } from "./mysqlTypes";

export function createPool(env = readEnv()): MysqlPool {
  return mysql.createPool({
    uri: env.mysqlUri,
    waitForConnections: true,
    connectionLimit: env.mysqlConnectionLimit,
    maxIdle: env.mysqlMaxIdle,
    idleTimeout: env.mysqlIdleTimeoutMs,
    namedPlaceholders: true
  }) as unknown as MysqlPool;
}

export type DbPool = ReturnType<typeof createPool>;
