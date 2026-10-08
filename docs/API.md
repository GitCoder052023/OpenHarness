# OpenHarness REST API Reference
### By OpenAgent

OpenHarness exposes 55+ macOS, browser, developer, web scraping, and social automation tools through a lightweight, high-performance Node.js HTTP server.

---

## Getting Started

### Start the Server

```bash
# Start on default port 8080 (http://localhost:8080)
npm start

# Or with custom port / host:
OPENHARNESS_PORT=9000 OPENHARNESS_HOST=127.0.0.1 npm start

# Or via Python boot engine:
./boot.py --port 8080
```

---

## Endpoints

### 1. Root Information
- **URL**: `GET /`
- **Description**: Returns service overview, version, total tools, and branding metadata.
- **Response**:
```json
{
  "service": "OpenHarness",
  "branding": "OpenHarness by OpenAgent",
  "tagline": "The open execution harness for autonomous agents on macOS",
  "version": "1.0.0",
  "uptime_seconds": 42,
  "total_tools": 49,
  "endpoints": { ... },
  "openagent_github": "https://github.com/GitCoder052023/OpenAgent"
}
```

---

### 2. Health & Engine Diagnostics
- **URL**: `GET /health` (or `GET /api/health`)
- **Description**: Reports availability of all 5 execution engines.
- **Response**:
```json
{
  "status": "ok",
  "service": "OpenHarness API",
  "branding": "OpenHarness by OpenAgent",
  "uptime_seconds": 45,
  "engines": {
    "harness": "ok",
    "mac_adapter": "ok",
    "browser_adapter": "ok",
    "firecrawl": "ok",
    "locoagent": "ok"
  },
  "total_tools": 49
}
```

---

### 3. Tool Catalog & Schemas
- **URL**: `GET /tools` (or `GET /api/tools`)
- **Query Parameters**:
  - `format`:
    - `standard` (default): full OpenHarness tool metadata.
    - `openai`: formats tools into OpenAI Function Calling schema (`[{ type: "function", function: { name, description, parameters } }]`).
    - `anthropic`: formats tools into Anthropic Claude Tool Use schema (`[{ name, description, input_schema }]`).
    - `mcp`: formats tools into Model Context Protocol schema (`[{ name, description, inputSchema }]`).
  - `engine`: filter by engine (`developer`, `macos`, `browser`, `firecrawl`, `social`).

#### Examples:
```bash
# Standard catalog
curl http://localhost:8080/tools

# OpenAI-compatible function definitions
curl "http://localhost:8080/tools?format=openai"

# Claude-compatible tool definitions
curl "http://localhost:8080/tools?format=anthropic"

# Only macOS native tools
curl "http://localhost:8080/tools?engine=macos"
```

---

### 4. Execute a Tool Call
- **URL**: `POST /execute` (or `POST /api/execute`)
- **Description**: Universal tool execution endpoint. Accepts OpenHarness standard format, OpenAI function calling format, Anthropic tool use format, or a batch array of calls.

#### Request Formats:

**Format A: Standard OpenHarness**
```json
{
  "tool": "bash",
  "args": {
    "command": "git status"
  }
}
```

**Format B: OpenAI Function Calling**
```json
{
  "type": "function",
  "function": {
    "name": "bash",
    "arguments": "{\"command\": \"git status\"}"
  }
}
```

**Format C: Anthropic Claude Tool Use**
```json
{
  "type": "tool_use",
  "name": "bash",
  "input": {
    "command": "git status"
  }
}
```

**Format D: Batch Calls**
```json
[
  { "tool": "read", "args": { "path": "package.json" } },
  { "tool": "system_info", "args": {} }
]
```

#### Response:
```json
{
  "id": "req_1_1728374829102",
  "status": "ok",
  "tool": "bash",
  "result": {
    "exit_code": 0,
    "output": "On branch main\nnothing to commit, working tree clean\n",
    "timed_out": false,
    "truncated": false,
    "cwd": "/Users/hamdan/OpenHarness"
  },
  "duration_ms": 48
}
```

---

### 5. Direct Tool Endpoint
- **URL**: `POST /tools/:tool_name`
- **Description**: Invokes the named tool directly. The request body is passed directly as tool arguments.

```bash
# Execute bash command directly:
curl -X POST http://localhost:8080/tools/bash \
  -H "Content-Type: application/json" \
  -d '{"command": "uptime"}'

# Open a URL in Chrome via CDP:
curl -X POST http://localhost:8080/tools/browser_open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/GitCoder052023/OpenAgent"}'

# Read file:
curl -X POST http://localhost:8080/tools/read \
  -H "Content-Type: application/json" \
  -d '{"path": "README.md", "limit": 20}'
```

---

### 6. Model Context Protocol (MCP) Manifest
- **URL**: `GET /mcp/manifest`
- **Description**: Returns MCP 2024-11-05 compatible tool manifests for MCP hosts and agents.

---

## Integrating with LLMs

### Python with Anthropic Claude
```python
import anthropic
import requests

client = anthropic.Anthropic()

# 1. Fetch available tools from OpenHarness
tools = requests.get("http://localhost:8080/tools?format=anthropic").json()["tools"]

# 2. Query Claude with tools
response = client.messages.create(
    model="claude-3-7-sonnet-20250219",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "What is the git status of the project?"}],
)

# 3. Forward tool call directly to OpenHarness
for block in response.content:
    if block.type == "tool_use":
        result = requests.post("http://localhost:8080/execute", json={
            "type": "tool_use",
            "name": block.name,
            "input": block.input
        }).json()
        print("Harness execution result:", result)
```

### Python with OpenAI / Codex
```python
import openai
import requests

client = openai.OpenAI()

# 1. Fetch available tools from OpenHarness
tools = requests.get("http://localhost:8080/tools?format=openai").json()["tools"]

# 2. Query model with tools
completion = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Check the OS hardware and version."}],
    tools=tools,
)

# 3. Forward tool calls directly to OpenHarness
for tool_call in completion.choices[0].message.tool_calls:
    result = requests.post("http://localhost:8080/execute", json={
        "type": "function",
        "function": {
            "name": tool_call.function.name,
            "arguments": tool_call.function.arguments,
        }
    }).json()
    print("Harness execution result:", result)
```

### TypeScript / Node.js
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai"

const toolsResponse = await fetch("http://localhost:8080/tools?format=openai")
const { tools } = await toolsResponse.json()

// Execute any tool call directly
const execRes = await fetch("http://localhost:8080/execute", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tool: "bash",
    args: { command: "node -v" }
  })
})
const data = await execRes.json()
console.log(data.result.output)
```
