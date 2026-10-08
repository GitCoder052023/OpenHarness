# OpenHarness HTTP API Reference

The OpenHarness HTTP API server (`src/server`) is a lightweight Node.js Express service that serves as the programmatic execution boundary for OpenHarness.

It forwards JSON tool execution requests across a persistent stdio IPC channel to an underlying Python worker (`openharness.worker`), which maintains in-memory adapters for developer tools, macOS automation, Chrome browser control, web scraping, and social platforms.

---

## Service Endpoints

The API server exposes three HTTP endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | `GET` | Health status and worker readiness check |
| `/` | `GET` | Service identity and status |
| `/api/execute` | `POST` | Execute a tool capability |

---

## 1. GET `/health`

Verifies that the HTTP process is running and reports whether the background Python worker process is initialized and responsive.

### Request

```http
GET /health HTTP/1.1
Host: 127.0.0.1:8080
```

### Response (`200 OK`)

**Worker Ready:**
```json
{
  "status": "ok",
  "worker": "ready"
}
```

**Worker Unavailable:**
```json
{
  "status": "ok",
  "worker": "unavailable"
}
```

If `"worker": "unavailable"` is returned, the HTTP server is alive but cannot execute tools. Ensure dependencies are installed (`./install.py` or `.venv/bin/python`) and check server logs.

---

## 2. GET `/`

Returns basic service metadata.

### Request

```http
GET / HTTP/1.1
Host: 127.0.0.1:8080
```

### Response (`200 OK`)

```json
{
  "name": "OpenHarness API",
  "status": "ok"
}
```

---

## 3. POST `/api/execute`

Dispatches a tool call to the OpenHarness execution layer.

### Request Headers

```http
Content-Type: application/json
```

### Request Body Schema

```json
{
  "tool": "<tool-name>",
  "args": {
    "<key>": "<value>"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tool` | `string` | **Yes** | Non-empty name of the OpenHarness tool (e.g. `system_info`, `bash`, `read`, `write`, `browser_open`, `mac_see`). |
| `args` | `object` | No | Key-value arguments object. Defaults to `{}` if omitted. Must NOT be an array or primitive. |

### Successful Execution (`200 OK`)

When the requested tool runs and succeeds, the server returns status `"ok"` with the tool name and execution payload:

```json
{
  "status": "ok",
  "tool": "bash",
  "result": {
    "exit_code": 0,
    "output": "Darwin Kernel Version 24.3.0 ...\n",
    "timed_out": false,
    "truncated": false,
    "cwd": "/Users/hamdan/OpenHarness"
  }
}
```

### Tool Execution Failure (`200 OK`)

When the request is well-formed, but the underlying tool reports an operational failure (e.g. unknown tool name, invalid tool arguments, non-zero exit code, file not found), the HTTP status remains `200 OK` and the envelope reports status `"error"`:

```json
{
  "status": "error",
  "tool": "bash",
  "error": "Command failed with exit code 1",
  "result": {
    "exit_code": 1,
    "output": "cat: missing-file.txt: No such file or directory\n",
    "timed_out": false
  }
}
```

When an unknown tool name is supplied:

```json
{
  "status": "error",
  "tool": "unknown_tool",
  "error": "Unknown harness tool: 'unknown_tool'"
}
```

---

## HTTP Transport & Validation Errors

When an error occurs before the tool can be dispatched to the worker, the server responds with an appropriate HTTP error status code:

| Status Code | Reason | Example Response |
|---|---|---|
| `400 Bad Request` | Missing `tool`, non-object `args`, or malformed JSON | `{"status": "error", "error": "Field 'tool' must be a non-empty string"}` |
| `404 Not Found` | Route does not exist | `{"status": "error", "error": "Route not found"}` |
| `503 Service Unavailable` | Python worker crashed or is not initialized | `{"status": "error", "error": "OpenHarness worker is unavailable"}` |
| `500 Internal Server Error` | IPC timeout or unhandled server exception | `{"status": "error", "error": "Worker request timed out after 120000ms"}` |

---

## Server Configuration

Server runtime parameters are configured through environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `OPENHARNESS_HOST` | `0.0.0.0` | Network interface to bind (`0.0.0.0` for local network access, `127.0.0.1` for localhost only) |
| `OPENHARNESS_PORT` | `8080` | Port number to listen on |
| `OPENHARNESS_TIMEOUT_MS` | `120000` | Transport request timeout in milliseconds (2 minutes) |
| `OPENHARNESS_PYTHON` | Auto | Path to Python interpreter (auto-detects `.venv/bin/python` if present) |

---

## Invocation Examples

### cURL

```bash
# 1. Health check
curl -s http://127.0.0.1:8080/health

# 2. Inspect system info
curl -s -X POST http://127.0.0.1:8080/api/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "system_info", "args": {}}'

# 3. Execute a shell command
curl -s -X POST http://127.0.0.1:8080/api/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "bash", "args": {"command": "uname -m"}}'
```

### TypeScript / Fetch

```typescript
interface ExecuteResponse<T = unknown> {
  status: "ok" | "error";
  tool: string;
  result?: T;
  error?: string;
}

async function callOpenHarness<T = unknown>(
  tool: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch("http://127.0.0.1:8080/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, args }),
  });

  const data = (await res.json()) as ExecuteResponse<T>;

  if (!res.ok || data.status === "error") {
    throw new Error(data.error || `Tool '${tool}' execution failed`);
  }

  return data.result as T;
}
```
