import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadMcpConfig } from "./config/mcp-config.js";
import { OpenHarnessApiClient } from "./client/openharness-api-client.js";
import { createMcpServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadMcpConfig();

  const apiClient = new OpenHarnessApiClient({
    baseUrl: config.apiUrl,
    timeoutMs: config.timeoutMs,
  });

  const server = createMcpServer({ apiClient });
  const transport = new StdioServerTransport();

  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    try {
      await server.close();
    } catch (err) {
      console.error(`[openharness-mcp] Error closing server on ${signal}:`, err);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("uncaughtException", (err) => {
    console.error("[openharness-mcp] Uncaught exception:", err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[openharness-mcp] Unhandled rejection:", reason);
    process.exit(1);
  });

  await server.connect(transport);
}

main().catch((err) => {
  console.error("[openharness-mcp] Fatal startup error:", err);
  process.exit(1);
});
