# OpenHarness Architecture & Design Specification
### By [OpenAgent](https://github.com/GitCoder052023/OpenAgent)

---

## 1. System Vision & Taxonomy

OpenHarness is the headless execution engine of OpenAgent extracted as an independent, model-agnostic repository.

```
                    ┌───────────────────────────┐
                    │  Instinct / Cloud Brain   │
                    └─────────────┬─────────────┘
                                  │ WhatsApp Transport
                    ┌─────────────▼─────────────┐
                    │        OpenAgent          │
                    │   (Voice / WhatsApp Body) │
                    └─────────────┬─────────────┘
                                  │ Uses internally
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                     OpenHarness (by OpenAgent)                    │
│             Headless, Model-Agnostic Execution Engine             │
│                                                                   │
│   ┌───────────────────────────────────────────────────────────┐   │
│   │              Node.js REST API / CLI / Python              │   │
│   └─────────────────────────────┬─────────────────────────────┘   │
│                                 │ Stdio JSON-RPC IPC              │
│   ┌─────────────────────────────▼─────────────────────────────┐   │
│   │                   Universal Dispatcher                    │   │
│   └──────┬──────────────┬──────────────┬──────────────┬───────┘   │
│          │              │              │              │           │
│   ┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐    │
│   │  Developer  ││ macOS Native││Browser CDP  ││  Firecrawl   │    │
│   │   Harness   ││Computer-Use ││  Control    ││ Web Scraper │    │
│   └─────────────┘└─────────────┘└─────────────┘└─────────────┘    │
│                                 │                                 │
│                          ┌──────▼──────┐                          │
│                          │  LocoAgent  │                          │
│                          │ Social Media│                          │
│                          └─────────────┘                          │
└───────────────────────────────────────────────────────────────────┘
```

### Hierarchy & Analogy
- **Next.js** is by **Vercel**
- **Skills** is by **Vercel**
- **OpenHarness** is by **OpenAgent**

OpenAgent is the complete consumer assistant product with ears, speech models, and messaging transport.
OpenHarness is the low-level, high-capability hands and operating environment.

---

## 2. Core Architectural Principles

### 1. Model & Framework Agnostic
OpenHarness does not prescribe an LLM, prompt format, or orchestration framework. Any system capable of HTTP or CLI execution can use OpenHarness:
- Anthropic Claude
- OpenAI / Codex
- Google Gemini
- Local models via Ollama, LMStudio, vLLM
- LangChain, LlamaIndex, AutoGen, CrewAI

### 2. Zero-Loss Schema Translation
Different LLM providers format function calling differently. OpenHarness solves this at the API boundary:
- `GET /tools?format=openai` -> `[{ type: "function", function: { name, description, parameters } }]`
- `GET /tools?format=anthropic` -> `[{ name, description, input_schema }]`
- `GET /tools?format=mcp` -> `[{ name, description, inputSchema }]`

And the `POST /execute` endpoint automatically detects and normalizes:
- Standard OpenHarness: `{ tool, args }`
- OpenAI: `{ type: "function", function: { name, arguments } }`
- Anthropic: `{ type: "tool_use", name, input }`

### 3. Persistent In-Memory Process Isolation (Stdio JSON-RPC)
To avoid the multi-second overhead of re-importing Python libraries, initializing browser automation channels, or spinning up subprocesses on every HTTP request:
- The Node.js server maintains a persistent child process running `openharness.worker`.
- Requests and responses pass over standard I/O streams using newline-delimited JSON.
- Adapters (Chrome CDP sessions, macOS AX permissions, Bun subprocesses) stay warm and persistent in memory.
- Dispatch latency is reduced to sub-millisecond overhead.

### 4. Fail-Safe Engine Fallbacks & Resilience
- Each engine is cleanly isolated behind an adapter.
- If Chrome CDP is not launched, Browser tools return clear actionable error diagnostics rather than crashing the server.
- If Firecrawl Docker daemon is not active, `firecrawl_*` tools notify the caller with setup instructions.
- Stdio worker automatically respawns if an unhandled signal occurs.

---

## 3. The 5 Execution Engines

1. **Developer Harness (`cli-harness/harness-bridge.ts`)**:
   - High-speed Bun execution for filesystem and shell operations.
   - Atomic file writing and unified diff chunk search-and-replace (`edit`).
   - Native AppleScript bridge via `osascript`.

2. **Native macOS Computer-Use (`macos-harness`)**:
   - Direct integration with macOS Accessibility (AX) APIs and CoreGraphics/Quartz.
   - PID-targeted clicks, keystrokes, and window inspections that don't steal user focus.

3. **Real Browser Control (`browser-harness`)**:
   - Chrome DevTools Protocol (CDP) control over existing user profiles or headless tabs.
   - Composited clicks bypassing shadow DOMs and nested iframes.
   - Built-in domain automation skills for 90+ sites.

4. **Web Ingestion (`firecrawl`)**:
   - Self-hosted or cloud Firecrawl connector.
   - HTML-to-clean-LLM-Markdown conversion, sitemap traversal, and recursive crawling.

5. **Social Media Automation (`locoagent`)**:
   - Persistent Chrome sessions for Threads, Reddit, X, and LinkedIn.
   - SQLite operation ledger ensuring zero accidental double-posts or duplicate replies.

---

## 4. Future Roadmap & Extensibility

- **Model Context Protocol (MCP)**: Full compliance with the MCP protocol specification so OpenHarness can be mounted directly into Claude Desktop and Cursor as an MCP server.
- **Skill Marketplace / Registry**: Loading modular skills and plugins on-demand.
- **Streaming Output**: SSE (Server-Sent Events) streaming for long-running shell and browser tasks.