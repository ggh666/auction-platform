import { buildRuntimeApp } from "./runtimeApp";

const { app, env } = buildRuntimeApp();

await app.listen({ host: env.host, port: env.port });
