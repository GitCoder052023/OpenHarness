/**
 * OpenHarness REST API Server
 * By OpenAgent
 *
 * Exposes 55+ developer, native desktop, browser, scraping, and social automation
 * tools to any LLM (Claude, Gemini, OpenAI/Codex, Ollama) via a lightweight HTTP API.
 */

import http from "node:http"
import { URL } from "node:url"
import { getHarnessBridge } from "./bridge.js"
import {
  TOOLS_MANIFEST,
  toOpenAITools,
  toAnthropicTools,
  toMCPTools,
} from "./tools-manifest.js"

const PORT = parseInt(process.env.OPENHARNESS_PORT || "8080", 10)
const HOST = process.env.OPENHARNESS_HOST || "0.0.0.0"
const START_TIME = Date.now()

const bridge = getHarnessBridge()

function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data, null, 2)
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  })
  res.end(jsonStr)
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
      if (body.length > 10 * 1024 * 1024) {
        // 10MB limit
        reject(new Error("Request payload too large"))
      }
    })
    req.on("end", () => {
      if (!body.trim()) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err.message}`))
      }
    })
    req.on("error", reject)
  })
}

function normalizeToolCall(body) {
  if (Array.isArray(body)) {
    return body.map(normalizeSingleCall).filter(Boolean)
  }
  return normalizeSingleCall(body)
}

function normalizeSingleCall(obj) {
  if (!obj || typeof obj !== "object") return null

  // 1. OpenAI format: { "type": "function", "function": { "name": "...", "arguments": "{...}" } }
  if (obj.function && typeof obj.function === "object") {
    const fn = obj.function
    let args = fn.arguments || {}
    if (typeof args === "string") {
      try {
        args = JSON.parse(args)
      } catch {
        args = { raw: args }
      }
    }
    return { tool: fn.name, args }
  }

  // 2. Anthropic format: { "type": "tool_use", "name": "...", "input": { ... } }
  if (obj.type === "tool_use" && obj.name) {
    return { tool: obj.name, args: obj.input || {} }
  }

  // 3. Standard format: { "tool": "...", "args": { ... } } or { "name": "...", "arguments": { ... } }
  const tool = obj.tool || obj.name
  const args = obj.args || obj.arguments || obj.parameters || obj.input || {}
  if (!tool || typeof tool !== "string") return null

  return { tool: tool.trim(), args: typeof args === "object" ? args : {} }
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    })
    res.end()
    return
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  const pathname = reqUrl.pathname
  const query = reqUrl.searchParams

  try {
    // -------------------------------------------------------------
    // GET / - Root welcome and branding
    // -------------------------------------------------------------
    if (req.method === "GET" && pathname === "/") {
      return sendJson(res, 200, {
        service: "OpenHarness",
        branding: "OpenHarness by OpenAgent",
        tagline: "The open execution harness for autonomous agents on macOS",
        version: "1.0.0",
        uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
        total_tools: TOOLS_MANIFEST.length,
        endpoints: {
          health: "GET /health",
          tools: "GET /tools (supports ?format=openai, ?format=anthropic, ?format=mcp, ?engine=...)",
          execute: "POST /execute",
          direct_tool: "POST /tools/:tool_name",
          mcp_manifest: "GET /mcp/manifest",
        },
        openagent_github: "https://github.com/GitCoder052023/OpenAgent",
      })
    }

    // -------------------------------------------------------------
    // GET /health - Engine health and uptime
    // -------------------------------------------------------------
    if (req.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
      let doctorStatus = null
      try {
        const docRes = await bridge.doctor(5000)
        doctorStatus = docRes.result || docRes
      } catch (err) {
        doctorStatus = { error: err.message }
      }

      return sendJson(res, 200, {
        status: "ok",
        service: "OpenHarness API",
        branding: "OpenHarness by OpenAgent",
        uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
        engines: doctorStatus,
        total_tools: TOOLS_MANIFEST.length,
      })
    }

    // -------------------------------------------------------------
    // GET /tools - Catalog of available tools & schemas
    // -------------------------------------------------------------
    if (req.method === "GET" && (pathname === "/tools" || pathname === "/api/tools")) {
      const format = query.get("format") || "standard"
      const engineFilter = query.get("engine")

      let tools = TOOLS_MANIFEST
      if (engineFilter) {
        tools = tools.filter((t) => t.engine === engineFilter.toLowerCase())
      }

      if (format === "openai") {
        return sendJson(res, 200, { tools: toOpenAITools(tools) })
      } else if (format === "anthropic") {
        return sendJson(res, 200, { tools: toAnthropicTools(tools) })
      } else if (format === "mcp") {
        return sendJson(res, 200, { tools: toMCPTools(tools) })
      }

      return sendJson(res, 200, {
        total: tools.length,
        tools,
      })
    }

    // -------------------------------------------------------------
    // GET /mcp/manifest - Model Context Protocol tool manifest
    // -------------------------------------------------------------
    if (req.method === "GET" && (pathname === "/mcp/manifest" || pathname === "/api/mcp/manifest")) {
      return sendJson(res, 200, {
        schema_version: "2024-11-05",
        name: "openharness",
        description: "OpenHarness by OpenAgent — macOS Execution Harness for LLM Agents",
        tools: toMCPTools(TOOLS_MANIFEST),
      })
    }

    // -------------------------------------------------------------
    // GET /tools/:name - Inspect single tool schema
    // -------------------------------------------------------------
    if (req.method === "GET" && pathname.startsWith("/tools/")) {
      const toolName = pathname.slice("/tools/".length).trim().toLowerCase()
      const tool = TOOLS_MANIFEST.find((t) => t.name.toLowerCase() === toolName)
      if (!tool) {
        return sendJson(res, 404, { error: `Tool '${toolName}' not found in OpenHarness catalog` })
      }
      return sendJson(res, 200, tool)
    }

    // -------------------------------------------------------------
    // POST /execute - Universal tool call executor
    // -------------------------------------------------------------
    if (req.method === "POST" && (pathname === "/execute" || pathname === "/api/execute")) {
      const body = await parseJsonBody(req)
      const normalized = normalizeToolCall(body)

      if (!normalized) {
        return sendJson(res, 400, {
          error: "Invalid tool call. Expected { tool: string, args: object } or OpenAI/Anthropic format.",
        })
      }

      // Handle batch execution
      if (Array.isArray(normalized)) {
        const results = []
        for (const call of normalized) {
          try {
            const resp = await bridge.execute(call.tool, call.args)
            results.push(resp)
          } catch (err) {
            results.push({
              status: "error",
              tool: call.tool,
              error: err.message,
            })
          }
        }
        return sendJson(res, 200, { batch_results: results })
      }

      // Single tool execution
      try {
        const resp = await bridge.execute(normalized.tool, normalized.args)
        return sendJson(res, resp.status === "error" ? 400 : 200, resp)
      } catch (err) {
        return sendJson(res, 500, {
          status: "error",
          tool: normalized.tool,
          error: err.message,
        })
      }
    }

    // -------------------------------------------------------------
    // POST /tools/:name - Direct tool invocation endpoint
    // -------------------------------------------------------------
    if (req.method === "POST" && pathname.startsWith("/tools/")) {
      const toolName = pathname.slice("/tools/".length).trim().toLowerCase()
      const body = await parseJsonBody(req)
      const args = typeof body === "object" && body !== null ? body : {}

      try {
        const resp = await bridge.execute(toolName, args)
        return sendJson(res, resp.status === "error" ? 400 : 200, resp)
      } catch (err) {
        return sendJson(res, 500, {
          status: "error",
          tool: toolName,
          error: err.message,
        })
      }
    }

    // Route not found
    return sendJson(res, 404, {
      error: `Route ${req.method} ${pathname} not found`,
      available_endpoints: ["GET /", "GET /health", "GET /tools", "POST /execute", "POST /tools/:name"],
    })
  } catch (err) {
    console.error("[Server Error]", err)
    return sendJson(res, 500, { error: err.message || "Internal server error" })
  }
})

export async function startServer(port = PORT, host = HOST) {
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log(`\n==============================================================================`)
      console.log(`  ⌘ OPENHARNESS REST API SERVER (by OpenAgent)`)
      console.log(`==============================================================================`)
      console.log(`  ✓ Listening on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`)
      console.log(`  ✓ Endpoints:`)
      console.log(`      GET  http://localhost:${port}/health`)
      console.log(`      GET  http://localhost:${port}/tools  (?format=openai|anthropic|mcp)`)
      console.log(`      POST http://localhost:${port}/execute`)
      console.log(`      POST http://localhost:${port}/tools/bash`)
      console.log(`==============================================================================\n`)
      resolve(server)
    })
  })
}

// Auto-start if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}

// Clean shutdown
function shutdown() {
  console.log("\nShutting down OpenHarness server...")
  bridge.close()
  server.close(() => {
    process.exit(0)
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
