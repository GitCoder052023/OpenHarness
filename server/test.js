/**
 * OpenHarness API Server Smoke Test
 * Tests API endpoints, tool schemas, and live execution.
 */

import { startServer } from "./index.js"

const PORT = 8189
const BASE = `http://localhost:${PORT}`

async function runTests() {
  console.log("Starting test server on port", PORT)
  const server = await startServer(PORT, "127.0.0.1")

  try {
    // 1. GET /
    console.log("\n[Test 1] Testing GET /...")
    const r1 = await fetch(`${BASE}/`)
    const j1 = await r1.json()
    console.log("Status:", r1.status, "Service:", j1.service, "Branding:", j1.branding)
    if (j1.service !== "OpenHarness") throw new Error("Root endpoint failed")

    // 2. GET /health
    console.log("\n[Test 2] Testing GET /health...")
    const r2 = await fetch(`${BASE}/health`)
    const j2 = await r2.json()
    console.log("Health status:", j2.status, "Engines:", j2.engines)
    if (j2.status !== "ok") throw new Error("Health check failed")

    // 3. GET /tools
    console.log("\n[Test 3] Testing GET /tools...")
    const r3 = await fetch(`${BASE}/tools`)
    const j3 = await r3.json()
    console.log("Total tools:", j3.total)
    if (j3.total < 30) throw new Error("Tools count lower than expected")

    // 4. GET /tools?format=openai
    console.log("\n[Test 4] Testing GET /tools?format=openai...")
    const r4 = await fetch(`${BASE}/tools?format=openai`)
    const j4 = await r4.json()
    console.log("OpenAI tools returned:", j4.tools.length, "Sample tool type:", j4.tools[0].type)
    if (j4.tools[0].type !== "function") throw new Error("OpenAI tool format failed")

    // 5. GET /tools?format=anthropic
    console.log("\n[Test 5] Testing GET /tools?format=anthropic...")
    const r5 = await fetch(`${BASE}/tools?format=anthropic`)
    const j5 = await r5.json()
    console.log("Anthropic tools returned:", j5.tools.length, "Sample tool input_schema:", !!j5.tools[0].input_schema)
    if (!j5.tools[0].input_schema) throw new Error("Anthropic tool format failed")

    // 6. POST /execute (Standard format)
    console.log("\n[Test 6] Testing POST /execute (bash)...")
    const r6 = await fetch(`${BASE}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "bash",
        args: { command: "echo 'OpenHarness Server Test OK'" },
      }),
    })
    const j6 = await r6.json()
    console.log("Execute status:", j6.status, "Output:", j6.result?.output?.trim())
    if (j6.status !== "ok" || !j6.result?.output?.includes("OpenHarness Server Test OK")) {
      throw new Error("Tool execution failed: " + JSON.stringify(j6))
    }

    // 7. POST /tools/bash (Direct format)
    console.log("\n[Test 7] Testing POST /tools/bash (direct invocation)...")
    const r7 = await fetch(`${BASE}/tools/bash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "echo 'Direct Endpoint OK'" }),
    })
    const j7 = await r7.json()
    console.log("Direct status:", j7.status, "Output:", j7.result?.output?.trim())
    if (j7.status !== "ok" || !j7.result?.output?.includes("Direct Endpoint OK")) {
      throw new Error("Direct tool execution failed: " + JSON.stringify(j7))
    }

    console.log("\n==============================================================================")
    console.log("  ✓ ALL 7 OPENHARNESS API TESTS PASSED SUCCESSFULLY!")
    console.log("==============================================================================\n")
  } finally {
    server.close()
    process.exit(0)
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
