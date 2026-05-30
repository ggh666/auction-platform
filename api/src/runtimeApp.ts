import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import { readEnv, type Env } from "./config/env";
import { createPool } from "./db/pool";
import type { MysqlPool } from "./db/mysqlTypes";
import { createMysqlAdminRepository } from "./modules/admin/admin.mysql.repository";
import { createMysqlAssetFollowsRepository } from "./modules/assetFollows/assetFollows.mysql.repository";
import { createMysqlAssetsRepository } from "./modules/assets/assets.mysql.repository";
import { createMysqlBidsRepository } from "./modules/bids/bids.mysql.repository";
import { createMysqlImageSafetyRepository } from "./modules/contentSafety/imageSafety.mysql.repository";
import { createMysqlSystemConfigsRepository } from "./modules/configs/configs.mysql.repository";
import { createMysqlNotificationsRepository } from "./modules/notifications/notifications.mysql.repository";
import { createMysqlPrincipalsRepository } from "./modules/principals/principals.mysql.repository";
import { createMysqlReportsService } from "./modules/reports/reports.mysql.service";
import { createMysqlUsersRepository } from "./modules/users/users.mysql.repository";

export type RuntimeApp = {
  app: FastifyInstance;
  env: Env;
};

export type RuntimeAppOptions = {
  env?: NodeJS.ProcessEnv;
  pool?: MysqlPool;
};

export function buildRuntimeApp(options: RuntimeAppOptions = {}): RuntimeApp {
  const env = readEnv(options.env);

  if (env.nodeEnv !== "production") {
    return { app: buildApp({ env: options.env }), env };
  }

  const pool = options.pool ?? createPool(env);
  const assets = createMysqlAssetsRepository(pool);
  const app = buildApp({
    env: options.env,
    usersRepository: createMysqlUsersRepository(pool),
    assetsRepository: assets,
    adminRepository: createMysqlAdminRepository(pool),
    bidsRepository: createMysqlBidsRepository(pool),
    reportsService: createMysqlReportsService(pool),
    assetFollowsRepository: createMysqlAssetFollowsRepository(pool),
    principalsRepository: createMysqlPrincipalsRepository(pool),
    configsRepository: createMysqlSystemConfigsRepository(pool),
    notificationsRepository: createMysqlNotificationsRepository(pool),
    imageSafetyRepository: createMysqlImageSafetyRepository(pool)
  });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  return { app, env };
}
