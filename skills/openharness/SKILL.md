---
name: openharness
description: Teaches agents how to discover, select, and invoke OpenHarness capabilities for local shell execution, file manipulation, native macOS desktop automation, Chrome browser control, web scraping, and social workflows via MCP or HTTP API.
---

# OpenHarness Agent Skill

OpenHarness is a unified execution harness for autonomous agents on macOS. It exposes developer tools, native desktop control, authenticated Chrome browser automation, web scraping, and social platform management through a lightweight Node.js API server and an MCP connector.

This skill instructs AI agents on when to select OpenHarness, how to format calls to its interfaces, and how to avoid common tool-use errors.

---

## Architecture & Mental Model

Never conflate the architectural layers of OpenHarness:

```text
       AI Agent
          │
          │ loads instructions
          ▼
   OpenHarness Skill (SKILL.md) ──► Teaches WHEN and HOW to interact
          │
          │ invokes runtime capability
          ▼
   OpenHarness MCP (stdio)      ──► Protocol bridge (`openharness_execute`)
          │
          │ HTTP POST /api/execute
          ▼
   OpenHarness API Server       ──► Local HTTP execution boundary (Port 8080)
          │
          │ stdio IPC
          ▼
   OpenHarness Worker           ──► Persistent Python process holding warm adapters
          │
          ▼
   Harness Execution Engines    ──► Developer, macOS GUI, Chrome, Firecrawl, LocoAgent
```

- **Skill**: Instructional documentation for you (the AI agent). Does not execute code directly.
- **MCP Connector**: Stdio protocol adapter exposing the `openharness_execute` tool to MCP clients.
- **HTTP API**: REST service listening at `http://127.0.0.1:8080` (endpoints: `GET /health`, `POST /api/execute`).
- **Worker**: Background Python process maintaining warm in-memory adapters for sub-millisecond response.
- **Harness Engines**: The actual underlying execution implementations on the host machine.

---

## When to Use OpenHarness

Activate OpenHarness when a user task requires interaction with the host computer through any of these 5 supported domains:

1. **Host Environment & Shell**:
   - Querying system hardware, OS version, memory, or battery (`system_info`).
   - Running non-interactive shell commands in macOS `zsh` (`bash`).
   - Paginated file reading or directory listing (`read`).
   - Atomic file writing (`write`) or exact search-and-replace edits with diffs (`edit`).
   - Fast codebase searches with ripgrep (`grep`) or file globbing (`glob`).
   - Native macOS AppleScript or JXA automation (`applescript`).

2. **Native macOS Desktop Computer-Use**:
   - Window screenshots and accessibility control inspection (`mac_see`).
   - Background mouse clicks, text typing, or keypresses targeted to a specific app without moving the user's physical cursor (`mac_click`, `mac_type`, `mac_key`).
   - Window listing and running app enumeration (`mac_windows`, `mac_apps`).
   - macOS Accessibility (AX) tree queries (`mac_ax`).

3. **Authenticated Chrome Browser Control**:
   - Navigating tabs in real Chrome sessions (`browser_open`, `browser_tabs`).
   - Compositor clicks and form filling safe for React/Vue synthetic events (`browser_click`, `browser_fill`).
   - Inspecting browser accessibility trees and DOM screenshots (`browser_ax`, `browser_see`, `browser_screenshot`).
   - Evaluating JavaScript in active page context (`browser_eval`).

4. **Web Scraping & Crawling**:
   - Converting dynamic web pages into clean LLM-optimized Markdown (`firecrawl_scrape`).
   - Domain-level recursive crawling and sitemaps (`firecrawl_crawl`, `firecrawl_map`).
   - Web searches returning markdown snippets (`firecrawl_search`).

5. **Social Media Automation**:
   - Operating persistent Chrome profiles for Threads, Reddit, X, LinkedIn, or Instagram (`social_targets`, `social_setup`, `social_post`, `social_reply`, `social_like`, `social_search`).
   - Checking deduplication ledgers before posting (`social_dedup_check`).

---

## When NOT to Use OpenHarness

- **Pure Reasoning & Code Generation**: If the user asks for an algorithm, an explanation, or code snippets, generate the answer directly using normal model reasoning.
- **Standard Agent Tools Available**: If your current agent environment already provides native file reading or terminal execution and the user did not specifically ask for OpenHarness or macOS-specific automation, prefer your built-in tools.
- **Indiscriminate Shell Execution**: Do NOT route every request to `bash`. Always choose the narrowest specific OpenHarness tool (e.g. use `read` instead of `bash: "cat ..."`, `system_info` instead of custom shell scripts).

---

## How to Interact with OpenHarness

### Route A: MCP Client Environment (Preferred for Agents)

When running inside an MCP-enabled agent (Claude Desktop, Cursor, Zed, Goose, etc.), call the single exposed tool:

**Tool Name**: `openharness_execute`

**Request Shape**:
```json
{
  "tool": "<supported_tool_name>",
  "args": {
    "<parameter_name>": "<value>"
  }
}
```

### Route B: HTTP API Environment

When communicating over HTTP:
- **Endpoint**: `POST http://127.0.0.1:8080/api/execute`
- **Headers**: `Content-Type: application/json`
- **Body**: `{"tool": "<supported_tool_name>", "args": { ... }}`

Refer to [API Reference](references/api.md) for full HTTP request/response schemas and [MCP Reference](references/mcp.md) for connector specifics.

---

## Tool Selection & Argument Rules

1. **Exact Tool Names**: Never invent tool names. Use the exact identifier from [Tool Reference](references/tools.md).
2. **Strict Argument Shapes**: `args` must be an object (not a string, array, or null). Empty parameter sets must be passed as `{}`.
3. **No Hallucinated Parameters**:
   - For `bash`: parameter is `"command"` (not `"cmd"` or `"script"`).
   - For `read`: parameter is `"path"` (not `"file"` or `"filename"`).
   - For `write`: parameters are `"path"` and `"content"`.
   - For `edit`: parameters are `"path"`, `"oldString"`, and `"newString"`.
   - For `browser_open`: parameter is `"url"` (not `"link"`).
   - For `mac_click`: parameters are `"x"` and `"y"` (numbers).
   - For `firecrawl_scrape`: parameter is `"url"`.

For complete argument schemas, consult [Tool Reference](references/tools.md).

---

## Safety & Trust Boundaries

OpenHarness operates with local user permissions on the host Mac. Observe these critical trust principles:

1. **Verify Destructive Operations**: Never execute destructive file operations (`rm -rf`, overwriting critical system files) or terminate processes without explicit user intent.
2. **Least Privilege**: Always select the narrowest tool. Use `read` for file inspection rather than `bash: "head -n 50 /path"`.
3. **Protected Targets**: The browser adapter strictly prohibits targeting WhatsApp Web (`web.whatsapp.com`) to prevent disrupting parent bridge sessions.
4. **Localhost Boundary**: OpenHarness is designed for local machine execution or private LANs. Never instruct users to bind it to public internet interfaces or unauthenticated tunnels.

---

## Error Handling & Recovery

When an OpenHarness call fails, analyze the response before retrying:

| Failure | Cause | Recovery Action |
|---|---|---|
| `Unknown harness tool: '<name>'` | Hallucinated or misspelled tool name | Check [Tool Reference](references/tools.md) for the exact tool name. Do not repeat the same invalid name. |
| `OpenHarness worker is unavailable` (HTTP 503) | API server is up but Python worker exited | Inform user to check terminal output or verify `.venv` dependencies with `./install.py`. Do not retry in a loop. |
| `API Unavailable / Connection Refused` | API server is not running on port 8080 | Remind user to start the server via `pnpm run server` in the OpenHarness directory. |
| `Missing required argument...` | Parameter omitted or misspelled | Check tool schema in [Tool Reference](references/tools.md) and supply the required key in `args`. |
| `Accessibility / Screen Recording error` | macOS TCC permissions missing for `mac_*` tools | Tell user to grant Accessibility and Screen Recording permissions in **macOS System Settings > Privacy & Security**. |
| `Command failed with exit code N` | Shell command returned non-zero | Read the `result.output` string to diagnose the root cause instead of blindly retrying the identical command. |

---

## Realistic Examples

### Example 1: Inspect System Information
**User Intent**: "What version of macOS is this machine running?"
**Action**:
```json
{
  "tool": "system_info",
  "args": {}
}
```
**Interpretation**: Parse the returned JSON object and synthesize a clear summary for the user.

### Example 2: Read Codebase File
**User Intent**: "Check what dependencies are declared in package.json."
**Action**:
```json
{
  "tool": "read",
  "args": {
    "path": "package.json",
    "limit": 60
  }
}
```
**Interpretation**: Review the `content` field returned in the response.

### Example 3: Scrape Documentation Web Page
**User Intent**: "Fetch the setup instructions from https://docs.example.com/start."
**Action**:
```json
{
  "tool": "firecrawl_scrape",
  "args": {
    "url": "https://docs.example.com/start",
    "only_main_content": true
  }
}
```
**Interpretation**: Use the clean extracted Markdown to answer the user's inquiry.

### Example 4: Browser Navigation
**User Intent**: "Open our staging app at http://localhost:3000 in Chrome."
**Action**:
```json
{
  "tool": "browser_open",
  "args": {
    "url": "http://localhost:3000",
    "new_tab": true
  }
}
```

---

## Detailed References

When deeper schema details or protocol specifications are needed, load:
- [Tool Reference](references/tools.md): Complete parameter catalogs, aliases, and examples for all 55+ tools.
- [API Reference](references/api.md): Detailed HTTP request/response payloads, headers, and status codes.
- [MCP Reference](references/mcp.md): Stdio transport setup, client configuration snippets, and error formats.
