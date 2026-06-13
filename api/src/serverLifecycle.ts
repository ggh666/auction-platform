import type { FastifyInstance } from "fastify";

type ShutdownSignal = "SIGINT" | "SIGTERM";

type GracefulShutdownOptions = {
  app: Pick<FastifyInstance, "close">;
  exit?: (code: number) => void;
  logError?: (error: unknown) => void;
};

export function createGracefulShutdownHandler(options: GracefulShutdownOptions) {
  let closing = false;
  const exit = options.exit ?? process.exit;
  const logError = options.logError ?? ((error) => console.error(error));

  return async function gracefulShutdown(_signal: ShutdownSignal): Promise<void> {
    if (closing) {
      return;
    }
    closing = true;
    try {
      await options.app.close();
      exit(0);
    } catch (error) {
      logError(error);
      exit(1);
    }
  };
}

export function installGracefulShutdown(app: Pick<FastifyInstance, "close">): void {
  const handler = createGracefulShutdownHandler({ app });
  process.once("SIGTERM", () => {
    void handler("SIGTERM");
  });
  process.once("SIGINT", () => {
    void handler("SIGINT");
  });
}
