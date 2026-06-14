import { describe, expect, it } from "vitest";
import { createGracefulShutdownHandler } from "../../api/src/serverLifecycle";

describe("server lifecycle", () => {
  it("closes Fastify before exiting on termination signals", async () => {
    const calls: string[] = [];
    let exitCode: number | undefined;
    const handler = createGracefulShutdownHandler({
      app: {
        async close() {
          calls.push("close");
        }
      },
      exit(code) {
        exitCode = code;
        calls.push(`exit:${code}`);
      }
    });

    await handler("SIGTERM");

    expect(calls).toEqual(["close", "exit:0"]);
    expect(exitCode).toBe(0);
  });

  it("exits with failure when graceful shutdown cannot close the app", async () => {
    const calls: string[] = [];
    const handler = createGracefulShutdownHandler({
      app: {
        async close() {
          calls.push("close");
          throw new Error("close failed");
        }
      },
      exit(code) {
        calls.push(`exit:${code}`);
      },
      logError(error) {
        calls.push(error instanceof Error ? error.message : String(error));
      }
    });

    await handler("SIGINT");

    expect(calls).toEqual(["close", "close failed", "exit:1"]);
  });
});
