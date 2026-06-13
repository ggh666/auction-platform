import { buildRuntimeApp } from "./runtimeApp";
import { installGracefulShutdown } from "./serverLifecycle";

const { app, env } = buildRuntimeApp();

installGracefulShutdown(app);

await app.listen({ host: env.host, port: env.port });
