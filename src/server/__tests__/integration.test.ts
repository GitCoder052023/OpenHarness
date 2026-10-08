import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { WorkerClient } from "../transport/worker-client.js";

test("End-to-End Real Worker Integration Test", async () => {
  let pythonPath = "python3";
  const venvPython = path.resolve(process.cwd(), ".venv/bin/python");
  if (fs.existsSync(venvPython)) {
    pythonPath = venvPython;
  }

  const workerClient = new WorkerClient({
    pythonPath,
    cwd: process.cwd(),
    defaultTimeoutMs: 30000,
  });

  const app = createApp({ workerClient });
  const server = http.createServer(app);

  let baseUrl = "";

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  try {
    // 1. Start real worker process
    await workerClient.start();
    assert.strictEqual(workerClient.isReady(), true);

    // 2. Test GET /health
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.strictEqual(healthRes.status, 200);
    const healthBody = (await healthRes.json()) as { status: string; worker: string };
    assert.strictEqual(healthBody.status, "ok");
    assert.strictEqual(healthBody.worker, "ready");

    // 3. Test POST /api/execute with safe bash command
    const execRes = await fetch(`${baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "bash",
        args: { command: "echo hello_integration" },
      }),
    });
    assert.strictEqual(execRes.status, 200);
    const execBody = (await execRes.json()) as {
      status: string;
      tool: string;
      result: { exit_code: number; output: string };
    };
    assert.strictEqual(execBody.status, "ok");
    assert.strictEqual(execBody.tool, "bash");
    assert.strictEqual(execBody.result.exit_code, 0);
    assert.match(execBody.result.output, /hello_integration/);

    // 4. Test POST /api/execute with unknown tool returns error response
    const unknownRes = await fetch(`${baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "unknown_test_tool",
        args: {},
      }),
    });
    assert.strictEqual(unknownRes.status, 200);
    const unknownBody = (await unknownRes.json()) as {
      status: string;
      tool: string;
      error: string;
    };
    assert.strictEqual(unknownBody.status, "error");
    assert.strictEqual(unknownBody.tool, "unknown_test_tool");
    assert.match(unknownBody.error, /Unknown harness tool/);
  } finally {
    // 5. Clean teardown
    await workerClient.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
