import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { OpenHarnessApiClient } from "../client/openharness-api-client.js";
import {
  ApiUnavailableError,
  ApiTimeoutError,
  ApiHttpError,
  ApiMalformedResponseError,
} from "../errors/mcp-error.js";

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

test("OpenHarnessApiClient Tests", async (t) => {
  await t.test("1. Sends correct POST request to /api/execute", async () => {
    let capturedMethod = "";
    let capturedUrl = "";
    let capturedHeaders: http.IncomingHttpHeaders = {};
    let capturedBody = "";

    const mockServer = await createMockHttpServer((req, res) => {
      capturedMethod = req.method || "";
      capturedUrl = req.url || "";
      capturedHeaders = req.headers;

      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        capturedBody = body;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            tool: "bash",
            result: { output: "test output" },
          })
        );
      });
    });

    try {
      const client = new OpenHarnessApiClient({ baseUrl: mockServer.baseUrl });
      const result = await client.executeTool("bash", { command: "echo hi" });

      assert.strictEqual(capturedMethod, "POST");
      assert.strictEqual(capturedUrl, "/api/execute");
      assert.strictEqual(capturedHeaders["content-type"], "application/json");
      assert.deepStrictEqual(JSON.parse(capturedBody), {
        tool: "bash",
        args: { command: "echo hi" },
      });
      assert.strictEqual(result.status, "ok");
      assert.deepStrictEqual((result as { result: unknown }).result, {
        output: "test output",
      });
    } finally {
      await mockServer.close();
    }
  });

  await t.test("2. Handles API HTTP error responses (e.g. 400 Bad Request)", async () => {
    const mockServer = await createMockHttpServer((_req, res) => {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "error",
          error: "Field 'tool' must be a non-empty string",
        })
      );
    });

    try {
      const client = new OpenHarnessApiClient({ baseUrl: mockServer.baseUrl });
      await assert.rejects(
        async () => {
          await client.executeTool("   ");
        },
        (err: unknown) => {
          assert(err instanceof ApiHttpError);
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.apiError, /Field 'tool' must be a non-empty string/);
          return true;
        }
      );
    } finally {
      await mockServer.close();
    }
  });

  await t.test("3. Handles 503 Service Unavailable when worker is down", async () => {
    const mockServer = await createMockHttpServer((_req, res) => {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "error",
          error: "OpenHarness worker is unavailable",
        })
      );
    });

    try {
      const client = new OpenHarnessApiClient({ baseUrl: mockServer.baseUrl });
      await assert.rejects(
        async () => {
          await client.executeTool("bash", { command: "pwd" });
        },
        (err: unknown) => {
          assert(err instanceof ApiHttpError);
          assert.strictEqual(err.statusCode, 503);
          assert.match(err.message, /OpenHarness worker is unavailable/);
          return true;
        }
      );
    } finally {
      await mockServer.close();
    }
  });

  await t.test("4. Surfaces ApiUnavailableError when server cannot be reached", async () => {
    // Pick an unused port
    const unreachableUrl = "http://127.0.0.1:59999";
    const client = new OpenHarnessApiClient({
      baseUrl: unreachableUrl,
      timeoutMs: 1000,
    });

    await assert.rejects(
      async () => {
        await client.executeTool("bash", { command: "ls" });
      },
      (err: unknown) => {
        assert(err instanceof ApiUnavailableError);
        assert.match(
          err.message,
          /Could not connect to OpenHarness API at http:\/\/127.0.0.1:59999/
        );
        return true;
      }
    );
  });

  await t.test("5. Enforces request timeout with ApiTimeoutError", async () => {
    const mockServer = await createMockHttpServer((_req, _res) => {
      // Intentionally do not respond to simulate hang/timeout
    });

    try {
      const client = new OpenHarnessApiClient({
        baseUrl: mockServer.baseUrl,
        timeoutMs: 50,
      });

      await assert.rejects(
        async () => {
          await client.executeTool("bash", { command: "sleep 10" });
        },
        (err: unknown) => {
          assert(err instanceof ApiTimeoutError);
          assert.match(
            err.message,
            /Request to OpenHarness API timed out after 50ms/
          );
          return true;
        }
      );
    } finally {
      await mockServer.close();
    }
  });

  await t.test("6. Detects malformed non-JSON response", async () => {
    const mockServer = await createMockHttpServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html>Not JSON</html>");
    });

    try {
      const client = new OpenHarnessApiClient({ baseUrl: mockServer.baseUrl });
      await assert.rejects(
        async () => {
          await client.executeTool("bash");
        },
        (err: unknown) => {
          assert(err instanceof ApiMalformedResponseError);
          assert.match(err.message, /Failed to parse response as JSON/);
          return true;
        }
      );
    } finally {
      await mockServer.close();
    }
  });

  await t.test("7. Health check verifies status ok", async () => {
    const mockServer = await createMockHttpServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", worker: "ready" }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    try {
      const client = new OpenHarnessApiClient({ baseUrl: mockServer.baseUrl });
      const health = await client.checkHealth();
      assert.strictEqual(health.status, "ok");
      assert.strictEqual(health.worker, "ready");
    } finally {
      await mockServer.close();
    }
  });
});
