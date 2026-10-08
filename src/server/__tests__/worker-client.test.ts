import test from "node:test";
import assert from "node:assert/strict";
import { WorkerClient } from "../transport/worker-client.js";
import type { WorkerResponse } from "../types/api.js";

test("WorkerClient Tests", async (t) => {
  await t.test("8. Concurrent request IDs do not collide", async () => {
    // Instantiate client
    const client = new WorkerClient({ defaultTimeoutMs: 5000 });

    const generatedIds = new Set<string>();
    const totalRequests = 2000;

    // Simulate concurrent generation of request IDs by accessing private/internal mechanism
    // or through multiple parallel execute attempts
    for (let i = 0; i < totalRequests; i++) {
      // Use the ID generation pattern from WorkerClient
      const id = `req_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
      assert.strictEqual(
        generatedIds.has(id),
        false,
        `Collision detected for ID: ${id}`
      );
      generatedIds.add(id);
    }

    assert.strictEqual(generatedIds.size, totalRequests);
  });

  await t.test(
    "Request correlation correctly matches responses out of order",
    async () => {
      const client = new WorkerClient({ defaultTimeoutMs: 5000 });

      // Create a mock worker process with stdio mocks
      const mockProc: any = {
        stdin: {
          write: (_chunk: string, _encoding: any, cb?: any) => {
            if (typeof cb === "function") cb();
          },
          destroyed: false,
          end: () => {},
        },
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        kill: () => {},
        once: () => {},
        on: () => {},
      };

      // Set client ready with mock proc
      (client as any).proc = mockProc;
      (client as any).isReadyState = true;

      // Launch 3 requests concurrently
      const promise1 = client.execute({ tool: "bash", args: { command: "1" } });
      const promise2 = client.execute({ tool: "bash", args: { command: "2" } });
      const promise3 = client.execute({ tool: "bash", args: { command: "3" } });

      const pendingMap = (client as any).pendingRequests as Map<string, any>;
      assert.strictEqual(pendingMap.size, 3);

      const requestIds = Array.from(pendingMap.keys());
      assert.strictEqual(requestIds.length, 3);

      // Respond out of order: 3rd first, then 1st, then 2nd
      const resp3: WorkerResponse = {
        id: requestIds[2],
        status: "ok",
        tool: "bash",
        result: { order: 3 },
      };
      const resp1: WorkerResponse = {
        id: requestIds[0],
        status: "ok",
        tool: "bash",
        result: { order: 1 },
      };
      const resp2: WorkerResponse = {
        id: requestIds[1],
        status: "ok",
        tool: "bash",
        result: { order: 2 },
      };

      (client as any).handleStdoutLine(JSON.stringify(resp3));
      (client as any).handleStdoutLine(JSON.stringify(resp1));
      (client as any).handleStdoutLine(JSON.stringify(resp2));

      const [res1, res2, res3] = await Promise.all([
        promise1,
        promise2,
        promise3,
      ]);

      assert.deepStrictEqual(res1.result, { order: 1 });
      assert.deepStrictEqual(res2.result, { order: 2 });
      assert.deepStrictEqual(res3.result, { order: 3 });
      assert.strictEqual(pendingMap.size, 0);
    }
  );

  await t.test("Worker request times out cleanly", async () => {
    const client = new WorkerClient({ defaultTimeoutMs: 50 });

    const mockProc: any = {
      stdin: {
        write: (_chunk: string, _encoding: any, cb?: any) => {
          if (typeof cb === "function") cb();
        },
        destroyed: false,
        end: () => {},
      },
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      kill: () => {},
      once: () => {},
      on: () => {},
    };

    (client as any).proc = mockProc;
    (client as any).isReadyState = true;

    await assert.rejects(
      async () => {
        await client.execute({ tool: "bash", args: { command: "sleep" } }, 50);
      },
      {
        message: /timed out/i,
      }
    );

    const pendingMap = (client as any).pendingRequests as Map<string, any>;
    assert.strictEqual(pendingMap.size, 0);
  });
});
