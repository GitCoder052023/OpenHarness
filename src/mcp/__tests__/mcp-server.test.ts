import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { OpenHarnessApiClient } from "../client/openharness-api-client.js";
import { createMcpServer } from "../server.js";
import {
  OPENHARNESS_EXECUTE_TOOL_NAME,
  validateExecuteArgs,
} from "../tools/execute-tool.js";

function createMockHttpServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
) {
  const server = http.createServer(handler);
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

async function createConnectedClientAndServer(baseUrl: string, timeoutMs = 2000) {
  const apiClient = new OpenHarnessApiClient({ baseUrl, timeoutMs });
  const server = createMcpServer({ apiClient });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "test-mcp-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    server,
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

type McpToolResponse = {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
  structuredContent?: unknown;
};

test("MCP Server & Tool Execution Tests", async (t) => {
  await t.test("1. Tool Registration: exposes openharness_execute tool", async () => {
    const mockServer = await createMockHttpServer((_req, res) => {
      res.writeHead(200);
      res.end();
    });

    const mcp = await createConnectedClientAndServer(mockServer.baseUrl);
    try {
      const toolList = await mcp.client.listTools();
      assert.strictEqual(toolList.tools.length, 1);

      const tool = toolList.tools[0];
      assert.strictEqual(tool.name, OPENHARNESS_EXECUTE_TOOL_NAME);
      assert.match(tool.description || "", /Execute an OpenHarness tool/);
      assert.deepStrictEqual(tool.inputSchema.required, ["tool"]);
      assert.ok(tool.inputSchema.properties?.tool);
      assert.ok(tool.inputSchema.properties?.args);
    } finally {
      await mcp.close();
      await mockServer.close();
    }
  });

  await t.test("2. Rejects unknown tool calls with MethodNotFound error", async () => {
    const mockServer = await createMockHttpServer((_req, res) => {
      res.writeHead(200);
      res.end();
    });

    const mcp = await createConnectedClientAndServer(mockServer.baseUrl);
    try {
      await assert.rejects(
        async () => {
          await mcp.client.callTool({
            name: "nonexistent_tool",
            arguments: {},
          });
        },
        (err: Error) => {
          assert.match(err.message, /Unknown tool/);
          return true;
        }
      );
    } finally {
      await mcp.close();
      await mockServer.close();
    }
  });

  await t.test("3. Valid Request: forwards tool and args to OpenHarness API", async () => {
    let capturedBody: unknown = null;

    const mockServer = await createMockHttpServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        capturedBody = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            tool: "bash",
            result: {
              exit_code: 0,
              output: "Darwin Kernel Version 24.3.0",
            },
          })
        );
      });
    });

    const mcp = await createConnectedClientAndServer(mockServer.baseUrl);
    try {
      const response = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: {
          tool: "bash",
          args: { command: "uname -a" },
        },
      })) as McpToolResponse;

      assert.deepStrictEqual(capturedBody, {
        tool: "bash",
        args: { command: "uname -a" },
      });
      assert.strictEqual(response.isError, false);
      assert.strictEqual(response.content.length, 1);
      assert.strictEqual(response.content[0].type, "text");
      assert.match(
        response.content[0].text,
        /Darwin Kernel Version 24\.3\.0/
      );
      assert.deepStrictEqual(
        response.structuredContent,
        {
          exit_code: 0,
          output: "Darwin Kernel Version 24.3.0",
        }
      );
    } finally {
      await mcp.close();
      await mockServer.close();
    }
  });

  await t.test("4. API Success: formats string result cleanly", async () => {
    const mockServer = await createMockHttpServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          tool: "read",
          result: "Contents of sample file",
        })
      );
    });

    const mcp = await createConnectedClientAndServer(mockServer.baseUrl);
    try {
      const response = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: {
          tool: "read",
          args: { path: "sample.txt" },
        },
      })) as McpToolResponse;

      assert.strictEqual(response.isError, false);
      assert.strictEqual(
        response.content[0].text,
        "Contents of sample file"
      );
    } finally {
      await mcp.close();
      await mockServer.close();
    }
  });

  await t.test("5. API Failure: surfaces worker execution error with isError=true", async () => {
    const mockServer = await createMockHttpServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "error",
          tool: "bash",
          error: "Command failed with exit code 1",
          result: { exit_code: 1, output: "No such file or directory" },
        })
      );
    });

    const mcp = await createConnectedClientAndServer(mockServer.baseUrl);
    try {
      const response = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: {
          tool: "bash",
          args: { command: "cat /nonexistent" },
        },
      })) as McpToolResponse;

      assert.strictEqual(response.isError, true);
      const text = response.content[0].text;
      assert.match(text, /Command failed with exit code 1/);
      assert.match(text, /No such file or directory/);
    } finally {
      await mcp.close();
      await mockServer.close();
    }
  });

  await t.test("6. HTTP Error: surfaces HTTP 503 error cleanly", async () => {
    const mockServer = await createMockHttpServer((_req, res) => {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "error",
          error: "OpenHarness worker is unavailable",
        })
      );
    });

    const mcp = await createConnectedClientAndServer(mockServer.baseUrl);
    try {
      const response = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: {
          tool: "bash",
          args: { command: "ls" },
        },
      })) as McpToolResponse;

      assert.strictEqual(response.isError, true);
      const text = response.content[0].text;
      assert.match(text, /HTTP 503/);
      assert.match(text, /OpenHarness worker is unavailable/);
    } finally {
      await mcp.close();
      await mockServer.close();
    }
  });

  await t.test("7. Input Validation: rejects missing or invalid tool arguments", async () => {
    const mockServer = await createMockHttpServer((_req, res) => {
      res.writeHead(200);
      res.end();
    });

    const mcp = await createConnectedClientAndServer(mockServer.baseUrl);
    try {
      // Missing tool
      const res1 = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: { args: { command: "ls" } },
      })) as McpToolResponse;
      assert.strictEqual(res1.isError, true);
      assert.match(
        res1.content[0].text,
        /Field 'tool' must be a non-empty string/
      );

      // Empty string tool
      const res2 = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: { tool: "   " },
      })) as McpToolResponse;
      assert.strictEqual(res2.isError, true);
      assert.match(
        res2.content[0].text,
        /Field 'tool' must be a non-empty string/
      );

      // args is not an object (primitive string)
      const res3 = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: { tool: "bash", args: "not-an-object" as unknown as Record<string, unknown> },
      })) as McpToolResponse;
      assert.strictEqual(res3.isError, true);
      assert.match(
        res3.content[0].text,
        /Field 'args' must be an object/
      );

      // args is an array
      const res4 = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: { tool: "bash", args: [1, 2] as unknown as Record<string, unknown> },
      })) as McpToolResponse;
      assert.strictEqual(res4.isError, true);
      assert.match(
        res4.content[0].text,
        /Field 'args' must be an object/
      );
    } finally {
      await mcp.close();
      await mockServer.close();
    }
  });

  await t.test("8. API Unavailable: returns clear connection error", async () => {
    // Unreachable address
    const mcp = await createConnectedClientAndServer("http://127.0.0.1:59998", 1000);
    try {
      const response = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: {
          tool: "bash",
          args: { command: "ls" },
        },
      })) as McpToolResponse;

      assert.strictEqual(response.isError, true);
      const text = response.content[0].text;
      assert.match(
        text,
        /Could not connect to OpenHarness API at http:\/\/127.0.0.1:59998/
      );
      assert.match(text, /Ensure the OpenHarness API server is running/);
    } finally {
      await mcp.close();
    }
  });

  await t.test("9. Timeout: returns clear timeout error when API hangs", async () => {
    const mockServer = await createMockHttpServer((_req, _res) => {
      // Hang indefinitely
    });

    const mcp = await createConnectedClientAndServer(mockServer.baseUrl, 50);
    try {
      const response = (await mcp.client.callTool({
        name: OPENHARNESS_EXECUTE_TOOL_NAME,
        arguments: {
          tool: "bash",
          args: { command: "sleep 10" },
        },
      })) as McpToolResponse;

      assert.strictEqual(response.isError, true);
      const text = response.content[0].text;
      assert.match(text, /Request to OpenHarness API timed out after 50ms/);
    } finally {
      await mcp.close();
      await mockServer.close();
    }
  });

  await t.test("10. validateExecuteArgs unit check", () => {
    assert.strictEqual(validateExecuteArgs(null).valid, false);
    assert.strictEqual(validateExecuteArgs([]).valid, false);
    assert.strictEqual(validateExecuteArgs({}).valid, false);
    assert.strictEqual(validateExecuteArgs({ tool: 123 }).valid, false);
    assert.strictEqual(validateExecuteArgs({ tool: "" }).valid, false);
    assert.strictEqual(validateExecuteArgs({ tool: "bash", args: null }).valid, false);

    const validWithNoArgs = validateExecuteArgs({ tool: "bash" });
    assert.strictEqual(validWithNoArgs.valid, true);
    if (validWithNoArgs.valid) {
      assert.strictEqual(validWithNoArgs.data.tool, "bash");
      assert.deepStrictEqual(validWithNoArgs.data.args, {});
    }

    const validWithArgs = validateExecuteArgs({
      tool: "read",
      args: { path: "file.txt" },
    });
    assert.strictEqual(validWithArgs.valid, true);
    if (validWithArgs.valid) {
      assert.strictEqual(validWithArgs.data.tool, "read");
      assert.deepStrictEqual(validWithArgs.data.args, { path: "file.txt" });
    }
  });
});
