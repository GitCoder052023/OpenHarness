/**
 * OpenHarness Tool Manifest & Catalog
 * By OpenAgent
 *
 * Full schema specifications for 55+ tools across 5 engines.
 * Converts to OpenAI function calling format, Anthropic tool format,
 * and Model Context Protocol (MCP) tool schemas.
 */

export const ENGINES = {
  DEVELOPER: "developer",
  MACOS: "macos",
  BROWSER: "browser",
  FIRECRAWL: "firecrawl",
  SOCIAL: "social",
}

export const TOOLS_MANIFEST = [
  // -------------------------------------------------------------
  // 1. Developer Harness Tools
  // -------------------------------------------------------------
  {
    name: "bash",
    engine: ENGINES.DEVELOPER,
    description: "Execute terminal shell commands in macOS zsh with output capture and timeout.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute." },
        cwd: { type: "string", description: "Working directory for command execution (defaults to project root)." },
        timeout_ms: { type: "integer", description: "Timeout in milliseconds (defaults to 60000)." },
      },
      required: ["command"],
    },
  },
  {
    name: "read",
    engine: ENGINES.DEVELOPER,
    description: "Read file contents with line/offset pagination or inspect directory contents.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative or absolute path to file or directory." },
        offset: { type: "integer", description: "Line offset to begin reading from." },
        limit: { type: "integer", description: "Maximum number of lines to return." },
      },
      required: ["path"],
    },
  },
  {
    name: "write",
    engine: ENGINES.DEVELOPER,
    description: "Atomically create or overwrite a file with given content.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Target file path." },
        content: { type: "string", description: "Full content to write." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit",
    engine: ENGINES.DEVELOPER,
    description: "Exact chunk search-and-replace in a file, returning a unified diff.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Target file path." },
        old_string: { type: "string", description: "Exact target substring to replace." },
        new_string: { type: "string", description: "Replacement content." },
        replace_all: { type: "boolean", description: "Whether to replace all occurrences (default false)." },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "grep",
    engine: ENGINES.DEVELOPER,
    description: "High-speed regex pattern search across files using ripgrep.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regular expression or literal pattern to search for." },
        path: { type: "string", description: "Directory or file path to search within." },
        include: { type: "string", description: "File glob filter (e.g. '*.ts', '*.py')." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "glob",
    engine: ENGINES.DEVELOPER,
    description: "Find files matching glob patterns with high performance.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (e.g. '**/*.json')." },
        path: { type: "string", description: "Root directory to search within." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "applescript",
    engine: ENGINES.DEVELOPER,
    description: "Execute multiline native AppleScript via osascript to control macOS applications and system events.",
    parameters: {
      type: "object",
      properties: {
        script: { type: "string", description: "The AppleScript code to execute." },
      },
      required: ["script"],
    },
  },
  {
    name: "system_info",
    engine: ENGINES.DEVELOPER,
    description: "Inspect local macOS hardware, architecture, OS version, and runtime status.",
    parameters: {
      type: "object",
      properties: {},
    },
  },

  // -------------------------------------------------------------
  // 2. Native macOS Computer-Use Primitives
  // -------------------------------------------------------------
  {
    name: "mac_see",
    engine: ENGINES.MACOS,
    description: "Capture window screenshot and extract interactive UI elements via macOS Accessibility tree.",
    parameters: {
      type: "object",
      properties: {
        app: { type: "string", description: "Application name or bundle identifier (e.g. 'Finder', 'Safari')." },
        window_index: { type: "integer", description: "Window index if app has multiple windows (default 0)." },
        send_image: { type: "boolean", description: "Whether to include raw base64 image data." },
        include_summary: { type: "boolean", description: "Whether to include human-readable AX element summary." },
      },
    },
  },
  {
    name: "mac_click",
    engine: ENGINES.MACOS,
    description: "PID-targeted mouse click without stealing window focus.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "X screen coordinate." },
        y: { type: "number", description: "Y screen coordinate." },
        app: { type: "string", description: "Target application name." },
        button: { type: "string", enum: ["left", "right"], description: "Mouse button (default 'left')." },
        click_count: { type: "integer", description: "Click count (1 for single, 2 for double click)." },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "mac_type",
    engine: ENGINES.MACOS,
    description: "Type text directly into a target application window.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type." },
        app: { type: "string", description: "Target application name." },
      },
      required: ["text"],
    },
  },
  {
    name: "mac_key",
    engine: ENGINES.MACOS,
    description: "Trigger keyboard shortcuts (e.g. 'cmd+s', 'enter', 'tab', 'cmd+shift+p').",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name or shortcut combination." },
        app: { type: "string", description: "Target application name." },
      },
      required: ["key"],
    },
  },
  {
    name: "mac_drag",
    engine: ENGINES.MACOS,
    description: "Perform drag-and-drop operations between screen coordinates.",
    parameters: {
      type: "object",
      properties: {
        start_x: { type: "number", description: "Starting X coordinate." },
        start_y: { type: "number", description: "Starting Y coordinate." },
        end_x: { type: "number", description: "Ending X coordinate." },
        end_y: { type: "number", description: "Ending Y coordinate." },
        app: { type: "string", description: "Target application." },
      },
      required: ["start_x", "start_y", "end_x", "end_y"],
    },
  },
  {
    name: "mac_scroll",
    engine: ENGINES.MACOS,
    description: "Send directional scroll events to target window coordinates.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate to scroll at." },
        y: { type: "number", description: "Y coordinate to scroll at." },
        dx: { type: "number", description: "Horizontal scroll delta." },
        dy: { type: "number", description: "Vertical scroll delta." },
        app: { type: "string", description: "Target application." },
      },
    },
  },
  {
    name: "mac_apps",
    engine: ENGINES.MACOS,
    description: "List all running applications with process IDs, bundle identifiers, and active status.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "mac_windows",
    engine: ENGINES.MACOS,
    description: "List open window titles and bounds for a target application.",
    parameters: {
      type: "object",
      properties: {
        app: { type: "string", description: "Application name." },
      },
    },
  },
  {
    name: "mac_ax",
    engine: ENGINES.MACOS,
    description: "Query and interact with macOS Accessibility elements directly.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", description: "Action to perform (e.g. 'find', 'click', 'dump')." },
        app: { type: "string", description: "Target application name." },
        text: { type: "string", description: "Element text or label match." },
      },
    },
  },
  {
    name: "mac_python",
    engine: ENGINES.MACOS,
    description: "Execute compound, multi-step macOS UI workflows locally in Python via macos-harness.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Python code to execute." },
        timeout: { type: "number", description: "Execution timeout in seconds (default 30.0)." },
      },
      required: ["code"],
    },
  },

  // -------------------------------------------------------------
  // 3. Real Browser Control (Browser Harness CDP)
  // -------------------------------------------------------------
  {
    name: "browser_open",
    engine: ENGINES.BROWSER,
    description: "Navigate to a URL or open a new tab in your authenticated Chrome session.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Target URL to open." },
        new_tab: { type: "boolean", description: "Whether to open in a new tab." },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_info",
    engine: ENGINES.BROWSER,
    description: "Inspect active page URL, title, viewport dimensions, and scroll offset.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "browser_click",
    engine: ENGINES.BROWSER,
    description: "Composited CDP mouse click bypassing iframes and shadow DOM.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "X viewport coordinate." },
        y: { type: "number", description: "Y viewport coordinate." },
        selector: { type: "string", description: "Optional CSS selector." },
        button: { type: "string", enum: ["left", "right"], description: "Mouse button." },
      },
    },
  },
  {
    name: "browser_fill",
    engine: ENGINES.BROWSER,
    description: "Framework-safe form input triggering React, Vue, and Angular synthetic events.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of input element." },
        text: { type: "string", description: "Text value to fill." },
        clear_first: { type: "boolean", description: "Whether to clear input before typing." },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "browser_type",
    engine: ENGINES.BROWSER,
    description: "Type text into currently focused web element.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text string to type." },
      },
      required: ["text"],
    },
  },
  {
    name: "browser_key",
    engine: ENGINES.BROWSER,
    description: "Trigger web keyboard shortcuts ('Enter', 'Escape', 'Tab', 'Backspace', etc.).",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name." },
        modifiers: { type: "array", items: { type: "string" }, description: "Modifier keys (e.g. ['Control', 'Shift'])." },
      },
      required: ["key"],
    },
  },
  {
    name: "browser_scroll",
    engine: ENGINES.BROWSER,
    description: "Scroll active page by delta pixels or scroll a specific selector into view.",
    parameters: {
      type: "object",
      properties: {
        dx: { type: "number", description: "Horizontal pixel delta." },
        dy: { type: "number", description: "Vertical pixel delta." },
        selector: { type: "string", description: "Selector to scroll into view." },
      },
    },
  },
  {
    name: "browser_tabs",
    engine: ENGINES.BROWSER,
    description: "Manage background tabs ('list', 'new', 'switch', 'close', 'current').",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "new", "switch", "close", "current"], description: "Tab action." },
        target: { type: "string", description: "Tab ID or index." },
        url: { type: "string", description: "URL if action is 'new'." },
      },
      required: ["action"],
    },
  },
  {
    name: "browser_see",
    engine: ENGINES.BROWSER,
    description: "Inspect tab state, take screenshot, and extract accessibility structure.",
    parameters: {
      type: "object",
      properties: {
        send_image: { type: "boolean", description: "Include base64 image data." },
        max_elements: { type: "integer", description: "Max elements to summarize." },
      },
    },
  },
  {
    name: "browser_eval",
    engine: ENGINES.BROWSER,
    description: "Evaluate arbitrary JavaScript expression in the active tab context.",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "JavaScript expression to evaluate." },
      },
      required: ["expression"],
    },
  },
  {
    name: "browser_wait",
    engine: ENGINES.BROWSER,
    description: "Wait for page load, network idle, or element appearance.",
    parameters: {
      type: "object",
      properties: {
        for_what: { type: "string", enum: ["load", "networkidle", "element"], description: "Event to wait for." },
        selector: { type: "string", description: "Element selector if waiting for element." },
        timeout: { type: "number", description: "Timeout in seconds (default 15.0)." },
      },
    },
  },
  {
    name: "browser_python",
    engine: ENGINES.BROWSER,
    description: "Ultra-fast compound browser burst execution (<200ms) directly via CDP.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Python code to execute against browser_harness." },
        timeout: { type: "number", description: "Timeout in seconds." },
      },
      required: ["code"],
    },
  },
  {
    name: "domain_skills",
    engine: ENGINES.BROWSER,
    description: "Retrieve pre-built domain automation skills for 80+ platforms (e.g. 'github.com', 'x.com').",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "Domain hostname (e.g. 'github.com')." },
      },
      required: ["host"],
    },
  },

  // -------------------------------------------------------------
  // 4. Web Ingestion & Extraction (Firecrawl Engine)
  // -------------------------------------------------------------
  {
    name: "firecrawl_scrape",
    engine: ENGINES.FIRECRAWL,
    description: "Scrape dynamic web pages directly into clean LLM-ready Markdown with table and link preservation.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Target URL to scrape." },
        formats: { type: "array", items: { type: "string" }, description: "Formats to return: ['markdown', 'html', 'rawHtml']." },
        only_main_content: { type: "boolean", description: "Exclude navigation, footers, and sidebars (default true)." },
        wait_for: { type: "integer", description: "Milliseconds to wait for dynamic client-side rendering." },
      },
      required: ["url"],
    },
  },
  {
    name: "firecrawl_search",
    engine: ENGINES.FIRECRAWL,
    description: "Search the web and return full Markdown content from top hits in one shot.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string." },
        limit: { type: "integer", description: "Maximum number of search results (default 5)." },
      },
      required: ["query"],
    },
  },
  {
    name: "firecrawl_crawl",
    engine: ENGINES.FIRECRAWL,
    description: "Asynchronously crawl an entire domain or documentation tree, returning a job ID.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Starting URL." },
        max_depth: { type: "integer", description: "Maximum recursion depth." },
        limit: { type: "integer", description: "Maximum pages to crawl." },
      },
      required: ["url"],
    },
  },
  {
    name: "firecrawl_status",
    engine: ENGINES.FIRECRAWL,
    description: "Check the progress and retrieve page contents of an ongoing crawl job.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "The crawl job ID." },
      },
      required: ["job_id"],
    },
  },
  {
    name: "firecrawl_map",
    engine: ENGINES.FIRECRAWL,
    description: "Fast sitemap and URL discovery across an entire domain.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Domain root URL." },
        search: { type: "string", description: "Optional URL filter term." },
      },
      required: ["url"],
    },
  },
  {
    name: "firecrawl_extract",
    engine: ENGINES.FIRECRAWL,
    description: "Extract structured JSON data matching a schema or prompt from web pages.",
    parameters: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" }, description: "List of URLs to extract from." },
        prompt: { type: "string", description: "Extraction prompt instructions." },
        schema: { type: "object", description: "JSON Schema structure to match." },
      },
      required: ["urls"],
    },
  },
  {
    name: "firecrawl_doctor",
    engine: ENGINES.FIRECRAWL,
    description: "Inspect health and availability of self-hosted local Firecrawl daemon.",
    parameters: {
      type: "object",
      properties: {},
    },
  },

  // -------------------------------------------------------------
  // 5. Social Media Automation (LocoAgent Engine)
  // -------------------------------------------------------------
  {
    name: "social_targets",
    engine: ENGINES.SOCIAL,
    description: "Inspect configured social platforms (Threads, Reddit, X, LinkedIn, etc.) and live CDP status.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "social_setup",
    engine: ENGINES.SOCIAL,
    description: "Launch persistent, isolated Chrome browser profile for a social platform.",
    parameters: {
      type: "object",
      properties: {
        target: { type: "string", description: "Platform name (e.g. 'threads', 'reddit', 'x')." },
        all: { type: "boolean", description: "Launch all platforms." },
        reset: { type: "boolean", description: "Reset profile data." },
      },
    },
  },
  {
    name: "social_post",
    engine: ENGINES.SOCIAL,
    description: "Publish a post with optional image/media attachment in an authenticated social session.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Post text content." },
        platform: { type: "string", description: "Target platform (defaults to 'threads')." },
        media: { type: "string", description: "Path to image/video attachment." },
      },
      required: ["text"],
    },
  },
  {
    name: "social_reply",
    engine: ENGINES.SOCIAL,
    description: "Reply to a post or discussion thread with automatic deduplication check.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Target post URL." },
        text: { type: "string", description: "Reply text." },
        platform: { type: "string", description: "Social platform." },
      },
      required: ["url", "text"],
    },
  },
  {
    name: "social_like",
    engine: ENGINES.SOCIAL,
    description: "Like or react to a post with deduplication verification.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Target post URL." },
        platform: { type: "string", description: "Social platform." },
      },
      required: ["url"],
    },
  },
  {
    name: "social_search",
    engine: ENGINES.SOCIAL,
    description: "Search social media discussions by keyword, hashtag, or topic.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query or hashtag." },
        platform: { type: "string", description: "Target platform." },
        tab: { type: "string", description: "Search tab (e.g. 'top', 'latest')." },
      },
      required: ["query"],
    },
  },
  {
    name: "social_screenshot",
    engine: ENGINES.SOCIAL,
    description: "Capture live social feed screenshot for visual verification.",
    parameters: {
      type: "object",
      properties: {
        platform: { type: "string", description: "Platform name." },
        full: { type: "boolean", description: "Full page capture." },
      },
    },
  },
  {
    name: "social_workflow",
    engine: ENGINES.SOCIAL,
    description: "Control automated social pipelines ('run', 'start', 'stop', 'status').",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["run", "start", "stop", "status"], description: "Pipeline action." },
        id: { type: "string", description: "Workflow ID." },
      },
      required: ["action"],
    },
  },
  {
    name: "social_agent_task",
    engine: ENGINES.SOCIAL,
    description: "Delegate an end-to-end autonomous social media mission (e.g. summarize and engage).",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Mission instructions." },
        model: { type: "string", description: "LLM model to drive agent." },
        timeout: { type: "number", description: "Timeout in seconds." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "social_dedup_check",
    engine: ENGINES.SOCIAL,
    description: "Check if a URL was already interacted with in the persistent SQLite ledger.",
    parameters: {
      type: "object",
      properties: {
        platform: { type: "string", description: "Platform name." },
        action: { type: "string", description: "Action name ('post', 'reply', 'like')." },
        url: { type: "string", description: "Target URL to check." },
      },
      required: ["platform", "action", "url"],
    },
  },
  {
    name: "social_doctor",
    engine: ENGINES.SOCIAL,
    description: "Run health checks on Bun, agent-browser CLI, and Chrome CDP for social automation.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
]

/**
 * Format manifest into OpenAI Function Calling format
 */
export function toOpenAITools(tools = TOOLS_MANIFEST) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

/**
 * Format manifest into Anthropic Tool Use format
 */
export function toAnthropicTools(tools = TOOLS_MANIFEST) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }))
}

/**
 * Format manifest into Model Context Protocol (MCP) format
 */
export function toMCPTools(tools = TOOLS_MANIFEST) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.parameters,
  }))
}
