import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { WorkerClient } from "../transport/worker-client.js";
import type { WorkerRequest, WorkerResponse } from "../types/api.js";

class MockWorkerClient extends WorkerClient {
  public mockReady = true;
  public lastRequest: Omit<WorkerRequest, "id"> | null = null;
  public mockResponse: WorkerResponse = {
    id: "mock_id",
    status: "ok",
    tool: "bash",
    result: { output: "mock output" },
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

function startTestServer(workerClient: MockWorkerClient) {
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

test("API Server Tests", async (t) => {
  const mockWorker = new MockWorkerClient();
  const testServer = await startTestServer(mockWorker);

  t.after(async () => {
    await testServer.close();
  });

  await t.test("1. GET /health returns success and worker ready state", async () => {
    mockWorker.mockReady = true;
    const res = await fetch(`${testServer.baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { status: string; worker: string };
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.worker, "ready");
  });

  await t.test("GET /health reports worker unavailable when not ready", async () => {
    mockWorker.mockReady = false;
    const res = await fetch(`${testServer.baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { status: string; worker: string };
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.worker, "unavailable");
    mockWorker.mockReady = true;
  });

  await t.test("GET / returns service information", async () => {
    const res = await fetch(`${testServer.baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { name: string; status: string };
    assert.strictEqual(body.name, "OpenHarness API");
    assert.strictEqual(body.status, "ok");
  });

  await t.test("2. POST /api/execute rejects missing tool", async () => {
    const res = await fetch(`${testServer.baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: { command: "ls" } }),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as { status: string; error: string };
    assert.strictEqual(body.status, "error");
    assert.match(body.error, /Field 'tool' must be a non-empty string/);
  });

  await t.test("POST /api/execute rejects empty tool string", async () => {
    const res = await fetch(`${testServer.baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "   ", args: {} }),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as { status: string; error: string };
    assert.strictEqual(body.status, "error");
    assert.match(body.error, /Field 'tool' must be a non-empty string/);
  });

  await t.test("3. POST /api/execute rejects invalid args shape", async () => {
    const res = await fetch(`${testServer.baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "bash", args: "not-an-object" }),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as { status: string; error: string };
    assert.strictEqual(body.status, "error");
    assert.match(body.error, /Field 'args' must be an object/);
  });

  await t.test("POST /api/execute rejects array as args", async () => {
    const res = await fetch(`${testServer.baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "bash", args: [1, 2] }),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as { status: string; error: string };
    assert.strictEqual(body.status, "error");
    assert.match(body.error, /Field 'args' must be an object/);
  });

  await t.test("4. POST /api/execute forwards canonical requests", async () => {
    mockWorker.mockReady = true;
    mockWorker.mockResponse = {
      id: "req_123",
      status: "ok",
      tool: "bash",
      result: { exit_code: 0, output: "test output" },
    };

    const res = await fetch(`${testServer.baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "bash",
        args: { command: "echo test" },
      }),
    });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(mockWorker.lastRequest, {
      tool: "bash",
      args: { command: "echo test" },
    });
  });

  await t.test("5. Successful worker response is returned to client", async () => {
    mockWorker.mockReady = true;
    mockWorker.mockResponse = {
      id: "req_456",
      status: "ok",
      tool: "read",
      result: { content: "file content" },
    };

    const res = await fetch(`${testServer.baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "read",
        args: { path: "README.md" },
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as {
      status: string;
      tool: string;
      result: { content: string };
    };
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.tool, "read");
    assert.deepStrictEqual(body.result, { content: "file content" });
  });

  await t.test("6. Worker execution error is returned correctly", async () => {
    mockWorker.mockReady = true;
    mockWorker.mockResponse = {
      id: "req_789",
      status: "error",
      tool: "bash",
      error: "Command failed with exit code 1",
    };

    const res = await fetch(`${testServer.baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "bash",
        args: { command: "false" },
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as {
      status: string;
      tool: string;
      error: string;
    };
    assert.strictEqual(body.status, "error");
    assert.strictEqual(body.tool, "bash");
    assert.strictEqual(body.error, "Command failed with exit code 1");
  });

  await t.test("7. Worker crash/unavailability returns HTTP 503", async () => {
    mockWorker.mockReady = false;

    const res = await fetch(`${testServer.baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "bash",
        args: { command: "pwd" },
      }),
    });

    assert.strictEqual(res.status, 503);
    const body = (await res.json()) as { status: string; error: string };
    assert.strictEqual(body.status, "error");
    assert.match(body.error, /unavailable/i);
    mockWorker.mockReady = true;
  });

  await t.test("Unknown route returns 404", async () => {
    const res = await fetch(`${testServer.baseUrl}/nonexistent`);
    assert.strictEqual(res.status, 404);
    const body = (await res.json()) as { status: string; error: string };
    assert.strictEqual(body.status, "error");
  });

  await t.test("Malformed JSON body returns 400", async () => {
    const res = await fetch(`${testServer.baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json{",
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as { status: string; error: string };
    assert.strictEqual(body.status, "error");
  });
});
