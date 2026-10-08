# OpenHarness MCP Connector Reference

The OpenHarness MCP connector (`src/mcp`) is a Model Context Protocol server communicating over standard input/output (`stdio`).

It acts as a protocol bridge between MCP-compliant AI agents (such as Claude Desktop, Cursor, Zed, Goose, or custom agent runners) and the local OpenHarness HTTP API server.

---

## Architectural Role

```text
AI Agent (MCP Host)
        │
        │ stdio JSON-RPC
        ▼
OpenHarness MCP Connector (`src/mcp/index.ts`)
        │
        │ HTTP POST /api/execute
        ▼
OpenHarness HTTP API Server (`http://127.0.0.1:8080`)
        │
        │ stdio IPC
        ▼
OpenHarness Python Worker (`openharness.worker`)
```

> **Important Operational Rule:**
> The MCP connector does **not** launch or supervise the API server. The API server must already be running (e.g. via `pnpm run server` or background daemon) before or while the MCP connector handles requests.

---

## Connector Configuration

The MCP connector reads configuration from environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `OPENHARNESS_API_URL` | `http://127.0.0.1:8080` | URL where the OpenHarness API server is reachable |
| `OPENHARNESS_MCP_TIMEOUT_MS` | `120000` | HTTP request timeout in milliseconds (falls back to `OPENHARNESS_TIMEOUT_MS` or 120000) |

---

## Exposed MCP Tool: `openharness_execute`

The connector deliberately exposes a single, unified execution tool.

### Definition

- **Tool Name**: `openharness_execute`
- **Description**: Execute an OpenHarness tool through the local OpenHarness API.

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "tool": {
      "type": "string",
      "description": "The name of the OpenHarness tool to execute (e.g. bash, read, write, edit, grep, glob, applescript, system_info, mac_see, browser_open)."
    },
    "args": {
      "type": "object",
      "description": "Optional key-value arguments for the tool."
    }
  },
  "required": ["tool"]
}
```

### Call Shape

```json
{
  "tool": "bash",
  "args": {
    "command": "sw_vers"
  }
}
```

---

## Output & Error Contract

The MCP connector handles the response from the API server and translates it into standard MCP `CallToolResult` items:

### 1. Successful Tool Execution

- `isError`: `false`
- `content`: Array containing text block with the formatted result string or JSON.
- `structuredContent`: Included when `result` is a JSON object.

Example output content text:
```text
ProductName:		macOS
ProductVersion:		14.5
BuildVersion:		23F79
```

### 2. Operational Failure / Tool Error

- `isError`: `true`
- `content`: Descriptive failure text indicating tool name, error explanation, and any detail returned by the tool.

Example:
```text
Tool 'bash' execution failed: Command failed with exit code 1

Result:
cat: nonexistent.log: No such file or directory
```

### 3. Argument Validation Error

- `isError`: `true`
- `content`: `Validation error: Field 'tool' must be a non-empty string`

### 4. API Unreachable / Worker Unavailable

If the API server is not running on `OPENHARNESS_API_URL` or responds with HTTP 503:
- `isError`: `true`
- `content`: Clear error explaining that the OpenHarness API server is unreachable, connection was refused, or the worker process is not ready.

---

## Client Configuration Examples

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "openharness": {
      "command": "pnpm",
      "args": ["mcp"],
      "cwd": "/path/to/OpenHarness",
      "env": {
        "OPENHARNESS_API_URL": "http://127.0.0.1:8080"
      }
    }
  }
}
```

### Cursor / VS Code MCP Configuration

```json
{
  "mcpServers": {
    "openharness": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/OpenHarness/src/mcp/index.ts"],
      "env": {
        "OPENHARNESS_API_URL": "http://127.0.0.1:8080"
      }
    }
  }
}
```

---

## Verification

To verify that the MCP server compiles and starts properly:

```bash
# Test MCP suite
pnpm run test:mcp

# Run the connector interactively (listens on stdin)
pnpm run mcp
```
