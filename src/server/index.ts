import http from "node:http";
import { loadConfig } from "./config/server-config.js";
import { WorkerClient } from "./transport/worker-client.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const workerClient = new WorkerClient({
    pythonPath: config.pythonPath,
    defaultTimeoutMs: config.timeoutMs,
  });

  const app = createApp({ workerClient });
  const server = http.createServer(app);

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Shutting down OpenHarness API server...`);

    server.close(() => {
      logger.info("HTTP server closed");
    });

    try {
      await workerClient.stop();
    } catch (err) {
      logger.error(`Error terminating worker: ${err}`);
    }

    logger.info("OpenHarness API server shutdown complete");
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await workerClient.start();

    server.listen(config.port, config.host, () => {
      logger.info(
        `OpenHarness API listening on http://${config.host}:${config.port}`
      );
    });
  } catch (err) {
    logger.error(`Failed to start OpenHarness API server: ${err}`);
    await workerClient.stop().catch(() => {});
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error(`Fatal error in OpenHarness API server: ${err}`);
  process.exit(1);
});
