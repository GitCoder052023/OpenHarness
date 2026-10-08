import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../server/app.js";
import { WorkerClient } from "../../server/transport/worker-client.js";
import type { WorkerRequest, WorkerResponse } from "../../server/types/api.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { OpenHarnessApiClient } from "../client/openharness-api-client.js";
import { createMcpServer } from "../server.js";
import { OPENHARNESS_EXECUTE_TOOL_NAME } from "../tools/execute-tool.js";

class IntegrationMockWorkerClient extends WorkerClient {
  public mockReady = true;
  public lastRequest: Omit<WorkerRequest, "id"> | null = null;
  public mockResponse: WorkerResponse = {
    id: "mock_id",
    status: "ok",
    tool: "bash",
    result: { output: "hello from mock worker" },
  };

  public override isReady(): boolean {
    return this.mockReady;
  }

  public override async execute(
    request: Omit<WorkerRequest, "id">
  ): Promise<WorkerResponse> {
    if (!this.mockReady) {
      throw new Error("Worker is not available");
    }
    this.lastRequest = request;
    return {
      ...this.mockResponse,
      tool: request.tool,
    };
  }
}

function startRealExpressServer(workerClient: IntegrationMockWorkerClient) {
  const app = createApp({ workerClient });
  const server = http.createServer(app);

  return new Promise<{
    server: http.Server;
    baseUrl: string;
    close: () => Promise<void>;
  }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve({
        server,
        baseUrl,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

test("MCP to OpenHarness HTTP API Integration Test", async (t) => {
  const mockWorker = new IntegrationMockWorkerClient();
  const expressServer = await startRealExpressServer(mockWorker);

  const apiClient = new OpenHarnessApiClient({
    baseUrl: expressServer.baseUrl,
    timeoutMs: 5000,
  });

  const mcpServer = createMcpServer({ apiClient });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client(
    { name: "integration-mcp-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await mcpServer.connect(serverTransport);
  await mcpClient.connect(clientTransport);

  t.after(async () => {
    await mcpClient.close();
    await mcpServer.close();
    await expressServer.close();
  });

  await t.test(
    "MCP request travels through MCP connector -> HTTP API -> Worker and back",
    async () => {
      mockWorker.mockReady = true;
      mockWorker.mockResponse = {
        id: "req_integ_1",
        status: "ok",
        tool: "bash",
        result: {
          exit_code: 0,
          output: "integrated execution successful",
        },
      };

      const result = (await mcpClient.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: {
          tool: "bash",
          args: { command: "echo test" },
        },
      })) as { isError?: boolean; content: Array<{ type: string; text: string }> };

      assert.strictEqual(result.isError, false);
      assert.strictEqual(result.content.length, 1);
      assert.strictEqual(result.content[0].type, "text");

      const parsedContent = JSON.parse(result.content[0].text);
      assert.strictEqual(
        parsedContent.output,
        "integrated execution successful"
      );
      assert.strictEqual(parsedContent.exit_code, 0);

      assert.deepStrictEqual(mockWorker.lastRequest, {
        tool: "bash",
        args: { command: "echo test" },
      });
    }
  );

  await t.test(
    "Worker failure propagates from API through MCP connector to MCP client",
    async () => {
      mockWorker.mockReady = true;
      mockWorker.mockResponse = {
        id: "req_integ_2",
        status: "error",
        tool: "bash",
        error: "Command failed with code 127",
      };

      const result = (await mcpClient.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: {
          tool: "bash",
          args: { command: "nonexistent_command" },
        },
      })) as { isError?: boolean; content: Array<{ type: string; text: string }> };

      assert.strictEqual(result.isError, true);
      assert.match(
        result.content[0].text,
        /Command failed with code 127/
      );
    }
  );

  await t.test(
    "Worker unavailable 503 propagates through MCP connector with isError=true",
    async () => {
      mockWorker.mockReady = false;

      const result = (await mcpClient.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: {
          tool: "bash",
          args: { command: "pwd" },
        },
      })) as { isError?: boolean; content: Array<{ type: string; text: string }> };

      assert.strictEqual(result.isError, true);
      assert.match(
        result.content[0].text,
        /HTTP 503/
      );
      assert.match(
        result.content[0].text,
        /OpenHarness worker is unavailable/
      );
    }
  );
});
