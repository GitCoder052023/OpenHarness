# OpenHarness Tool Reference

This document catalogs the tools supported by the OpenHarness execution layer (`src/openharness/dispatcher.py`).

When calling OpenHarness via MCP or the HTTP API, provide the exact tool name in `tool` and the expected key-value mapping in `args`:

```json
{
  "tool": "<tool-name>",
  "args": {
    "<parameter>": "<value>"
  }
}
```

---

## 1. Developer Harness Tools

Headless development primitives executed via local Node/Bun subprocess.

### `bash`
Execute non-interactive shell commands in the user's environment via `zsh`.
- **Arguments**:
  - `command` (*string*, required): Shell command line to execute.
  - `cwd` (*string*, optional): Working directory for the command.
  - `timeout_ms` (*number*, optional, default `60000`): Timeout in milliseconds.
- **Example**:
  ```json
  {
    "tool": "bash",
    "args": {
      "command": "git status --short",
      "timeout_ms": 10000
    }
  }
  ```
- **Returns**: `{ exit_code: number, output: string, timed_out: boolean, truncated: boolean, cwd: string }`
- **Limitations**: Do not launch long-running daemons or interactive commands requiring user keyboard input (e.g. `vim`, `top`).

### `read`
Read text files with line range slicing or inspect directory listings.
- **Arguments**:
  - `path` (*string*, required): Relative or absolute path to a file or directory.
  - `offset` (*number*, optional): Starting line index (1-based) or byte offset.
  - `limit` (*number*, optional): Maximum lines or entries to return.
- **Example**:
  ```json
  {
    "tool": "read",
    "args": {
      "path": "package.json",
      "limit": 50
    }
  }
  ```
- **Returns**: File content with line counts, or directory entry listing if `path` is a folder.

### `write`
Atomically write or overwrite content to a file.
- **Arguments**:
  - `path` (*string*, required): Target file path.
  - `content` (*string*, required): Full file content string.
- **Example**:
  ```json
  {
    "tool": "write",
    "args": {
      "path": "temp_note.txt",
      "content": "Updated notes\n"
    }
  }
  ```
- **Limitations**: Replaces the entire file. Use `edit` for targeted surgical modifications.

### `edit`
Exact chunk search-and-replace on an existing file with unified diff output.
- **Arguments**:
  - `path` (*string*, required): Path to file.
  - `oldString` (*string*, required; alias: `old_string`): Exact chunk to find (including indentation).
  - `newString` (*string*, required; alias: `new_string`): Replacement chunk.
  - `replaceAll` (*boolean*, optional, default `false`; alias: `replace_all`): Replace every match.
- **Example**:
  ```json
  {
    "tool": "edit",
    "args": {
      "path": "config.json",
      "oldString": "\"debug\": false",
      "newString": "\"debug\": true"
    }
  }
  ```
- **Returns**: `{ replacements: number, diff: string }`

### `grep`
Fast regex search across files powered by ripgrep.
- **Arguments**:
  - `pattern` (*string*, required): Regular expression or search pattern.
  - `path` (*string*, optional, default `"."`): Search directory root.
  - `include` (*string*, optional): Glob filter (e.g. `"*.ts"`).
- **Example**:
  ```json
  {
    "tool": "grep",
    "args": {
      "pattern": "loadConfig",
      "path": "src",
      "include": "*.ts"
    }
  }
  ```

### `glob`
Find files matching a glob pattern.
- **Arguments**:
  - `pattern` (*string*, required): Glob string (e.g. `"**/*.test.ts"`).
  - `path` (*string*, optional, default `"."`): Root search directory.
- **Example**:
  ```json
  {
    "tool": "glob",
    "args": {
      "pattern": "src/**/*.ts"
    }
  }
  ```

### `system_info`
Query host machine hardware and OS metrics.
- **Arguments**: `{}`
- **Example**:
  ```json
  {
    "tool": "system_info",
    "args": {}
  }
  ```
- **Returns**: macOS version, Darwin kernel, CPU architecture, core count, memory usage, uptime, battery status.

### `applescript`
Execute native macOS AppleScript or JavaScript for Automation (JXA) scripts via `osascript`.
- **Arguments**:
  - `script` (*string*, required): AppleScript code.
- **Example**:
  ```json
  {
    "tool": "applescript",
    "args": {
      "script": "tell application \"Finder\" to get name of front window"
    }
  }
  ```

---

## 2. Native macOS Computer-Use Tools

Native desktop vision, Accessibility tree queries, and background UI automation (`macos-harness`).

> **Permissions**: Requires macOS **Accessibility** and **Screen Recording** permissions granted in System Settings > Privacy & Security.

### `mac_see` (alias: `see`)
Capture window screenshot and extract visible interactive controls.
- **Arguments**:
  - `app` (*string*, optional): Target application name (e.g. `"Notes"`, `"Finder"`). Frontmost window if omitted.
  - `window_index` (*number*, optional, default `0`): Target window index.
  - `max_width` (*number*, optional, default `1280`): Max image width.
  - `max_height` (*number*, optional, default `1280`): Max image height.
  - `include_summary` (*boolean*, optional, default `true`): Extract interactive controls list.
- **Example**:
  ```json
  {
    "tool": "mac_see",
    "args": {
      "app": "Finder"
    }
  }
  ```

### `mac_click` (alias: `click`)
Send a background PID-targeted mouse click without moving the user's physical cursor.
- **Arguments**:
  - `x` (*number*, required): Window-relative X coordinate.
  - `y` (*number*, required): Window-relative Y coordinate.
  - `app` (*string*, optional): Target app.
  - `button` (*string*, optional, default `"left"`): `"left"`, `"right"`, `"double"`.
  - `click_count` (*number*, optional, default `1`): Number of clicks.
- **Example**:
  ```json
  {
    "tool": "mac_click",
    "args": {
      "x": 120,
      "y": 45,
      "app": "Finder"
    }
  }
  ```

### `mac_type` (alias: `type`)
Type text into an application window without stealing desktop focus.
- **Arguments**:
  - `text` (*string*, required): Text string to type.
  - `app` (*string*, optional): Target application.

### `mac_key` (alias: `key`)
Send special keyboard keys or key combinations.
- **Arguments**:
  - `key` (*string*, required): Key name or shortcut (e.g. `"return"`, `"tab"`, `"escape"`, `"space"`, `"command+c"`).
  - `app` (*string*, optional): Target application.

### `mac_drag` (alias: `drag`)
Perform mouse drag gesture between two points.
- **Arguments**:
  - `start_x`, `start_y` (or `from_x`, `from_y`) (*number*, required)
  - `end_x`, `end_y` (or `to_x`, `to_y`) (*number*, required)
  - `app` (*string*, optional)
  - `duration` (*number*, optional, default `0.35`): Seconds.

### `mac_scroll` (alias: `scroll`)
Scroll inside a window without stealing focus.
- **Arguments**:
  - `x` (*number*, optional, default `0`): Window X coordinate.
  - `y` (*number*, optional, default `0`): Window Y coordinate.
  - `dx` (*number*, optional, default `0`): Horizontal delta.
  - `dy` (*number*, optional, default `0`): Vertical delta (negative = down).
  - `app` (*string*, optional): Target app.

### `mac_apps` (alias: `apps`)
List running macOS applications and their process IDs (PIDs).
- **Arguments**: `{}`

### `mac_windows` (alias: `windows`)
List open window titles and bounding coordinates.
- **Arguments**:
  - `app` (*string*, optional): Filter by application.

### `mac_ax` (alias: `ax`)
Query or interact directly with the macOS Accessibility (AX) tree.
- **Arguments**:
  - `action` (*string*, optional, default `"query"`): `"query"` or `"action"`.
  - `app` (*string*, optional): Target app.
  - `text` (*string*, optional): Match element containing text.
  - `element_index` (*number*, optional): Specific element to interact with.
  - `element_action` (*string*, optional, default `"AXPress"`): Action to perform.
  - `limit` (*number*, optional, default `20`): Max results.

### `mac_python` (aliases: `mac_run`, `python`, `mac_script`)
Execute compound in-process Python script with `mac`, `browser`, `firecrawl`, `subprocess`, `Path` in namespace.
- **Arguments**:
  - `code` (*string*, required): Python code string.
  - `timeout` (*number*, optional, default `30.0`): Timeout in seconds.

### `mac_doctor` (alias: `doctor`)
Inspect macOS Accessibility and Screen Recording permissions status.
- **Arguments**: `{}`

---

## 3. Real Chrome Browser Control Tools

Direct background Chrome control via Chrome DevTools Protocol (`browser-harness`).

> **Targeting Restriction**: Operations targeting `web.whatsapp.com` or `whatsapp.com` are blocked to preserve bridge integrity.

### `browser_open` (aliases: `browser_goto`, `browser_navigate`)
Navigate active or new tab to a URL.
- **Arguments**:
  - `url` (*string*, required): Target URL.
  - `new_tab` (*boolean*, optional, default `false`): Open in a new tab.

### `browser_info` (alias: `browser_page_info`)
Inspect active Chrome tab title, URL, viewport size, and scroll offset.
- **Arguments**: `{}`

### `browser_click`
Click an element or coordinates via CDP compositor (bypasses iframes and shadow DOM).
- **Arguments**:
  - `selector` (*string*, optional): CSS selector.
  - `x`, `y` (*number*, optional): Coordinates.
  - `button` (*string*, optional, default `"left"`): Mouse button.
  - `click_count` (*number*, optional, default `1`)

### `browser_fill`
Framework-safe input field filling (triggers React/Vue synthetic events).
- **Arguments**:
  - `selector` (*string*, required): CSS selector.
  - `text` (*string*, required; alias: `value`): Text to fill.
  - `clear_first` (*boolean*, optional, default `true`): Clear existing text before typing.
  - `timeout` (*number*, optional, default `5.0`): Element wait timeout in seconds.

### `browser_type`
Type keyboard characters into the active element.
- **Arguments**:
  - `text` (*string*, required)

### `browser_key`
Send special keyboard key to Chrome.
- **Arguments**:
  - `key` (*string*, required, e.g. `"Enter"`, `"Escape"`, `"Tab"`).
  - `modifiers` (*number*, optional, default `0`)

### `browser_scroll`
Scroll page viewport or scroll specific element into view.
- **Arguments**:
  - `selector` (*string*, optional): Target element selector.
  - `dx` (*number*, optional, default `0`): Horizontal scroll.
  - `dy` (*number*, optional, default `-300`): Vertical scroll (negative = scroll down).

### `browser_tabs`
List or manipulate open Chrome tabs.
- **Arguments**:
  - `action` (*string*, optional, default `"list"`): `"list"`, `"new"`, `"switch"`, `"close"`.
  - `target` (*string*, optional): Target tab ID or index.
  - `url` (*string*, optional): URL for new tab.

### `browser_see`
Capture viewport screenshot and inspect visible interactive controls.
- **Arguments**:
  - `max_elements` (*number*, optional, default `25`)

### `browser_screenshot`
Take a full-page or viewport screenshot saved to disk.
- **Arguments**:
  - `path` (*string*, optional): Destination file path.
  - `full` (*boolean*, optional, default `false`): Capture entire scrollable page.

### `browser_ax`
Query browser Accessibility tree.
- **Arguments**:
  - `action` (*string*, optional, default `"query"`): Query action.
  - `text` (*string*, optional): Filter by element text.
  - `role` (*string*, optional): Filter by AX role.
  - `limit` (*number*, optional, default `25`)

### `browser_eval` (alias: `browser_js`)
Evaluate JavaScript in active page context.
- **Arguments**:
  - `expression` (*string*, required; aliases: `script`, `code`): JavaScript snippet.
  - `target_id` (*string*, optional): Specific tab ID.

### `browser_wait`
Wait for page lifecycle event or element visibility.
- **Arguments**:
  - `for_what` (*string*, optional, default `"load"`): `"load"`, `"selector"`, `"idle"`.
  - `selector` (*string*, optional): CSS selector to wait for.
  - `timeout` (*number*, optional, default `15.0`)

### `browser_python` (aliases: `browser_run`, `browser_script`)
Execute compound browser automation script in Python.
- **Arguments**:
  - `code` (*string*, required)
  - `timeout` (*number*, optional, default `30.0`)

---

## 4. Web Ingestion & Scraping Tools (Firecrawl)

Extract clean LLM-ready Markdown from dynamic websites and execute domain crawling.

### `firecrawl_scrape` (aliases: `scrape`, `scrape_url`)
Scrape a web page directly into LLM-optimized Markdown.
- **Arguments**:
  - `url` (*string*, required): Web page URL.
  - `formats` (*array|string*, optional): Formats (e.g. `["markdown"]`, `["html"]`).
  - `only_main_content` (*boolean*, optional, default `true`): Strip nav, footer, ads.
  - `wait_for` (*number*, optional): Milliseconds to wait before scraping.
  - `timeout` (*number*, optional): Scraping timeout in milliseconds.
  - `include_tags` (*array*, optional)
  - `exclude_tags` (*array*, optional)
- **Example**:
  ```json
  {
    "tool": "firecrawl_scrape",
    "args": {
      "url": "https://example.com/docs",
      "only_main_content": true
    }
  }
  ```

### `firecrawl_search` (aliases: `web_search`, `search_web`)
Execute a web search query and return scraped Markdown snippets.
- **Arguments**:
  - `query` (*string*, required; alias: `q`): Search query string.
  - `limit` (*number*, optional, default `5`): Result count.

### `firecrawl_crawl` (aliases: `crawl`, `crawl_site`)
Initiate an asynchronous recursive crawl of a domain.
- **Arguments**:
  - `url` (*string*, required): Starting URL.
  - `max_depth` (*number*, optional, default `2`): Crawl depth.
  - `limit` (*number*, optional, default `10`): Max pages to crawl.
  - `allow_backward_links` (*boolean*, optional, default `false`)
  - `allow_external_links` (*boolean*, optional, default `false`)
- **Returns**: Job ID for polling status.

### `firecrawl_status` (alias: `crawl_status`)
Check the progress and results of an ongoing crawl job.
- **Arguments**:
  - `job_id` (*string*, required; alias: `id`): Job ID from crawl initiation.

### `firecrawl_cancel` (alias: `cancel_crawl`)
Cancel an ongoing crawl job.
- **Arguments**:
  - `job_id` (*string*, required; alias: `id`)

### `firecrawl_map` (aliases: `site_map`, `sitemap`)
Extract URLs and sitemap links from a domain.
- **Arguments**:
  - `url` (*string*, required): Root website URL.
  - `search` (*string*, optional): Filter URL substring.
  - `limit` (*number*, optional, default `100`)

### `firecrawl_extract` (alias: `extract`)
Extract structured schema or entities from web pages according to a prompt.
- **Arguments**:
  - `urls` (*string|array*, required; alias: `url`): URL(s) to extract from.
  - `prompt` (*string*, optional): Extraction guidance.
  - `schema` (*object*, optional): JSON Schema object.

### `firecrawl_doctor` (alias: `firecrawl_health`)
Verify Firecrawl connectivity and server health.
- **Arguments**: `{}`

---

## 5. Social Media Automation Tools (LocoAgent)

Manage persistent Chrome sessions on Threads, Reddit, X, LinkedIn, and Instagram with anti-deduplication checks.

### `social_targets` (aliases: `social_platforms`, `social_status`)
Check online status and account handles for connected social platforms.
- **Arguments**: `{}`

### `social_setup` (aliases: `social_setup_chrome`, `setup_chrome`)
Launch or reset dedicated Chrome profile with remote debugging port.
- **Arguments**:
  - `target` (*string*, optional, default `"threads"`; alias: `platform`): `"threads"`, `"reddit"`, `"x"`, `"linkedin"`, `"instagram"`.
  - `reset` (*boolean*, optional, default `false`): Reset browser profile data.
  - `all` (*boolean*, optional, default `false`): Launch all platform profiles.

### `social_post` (aliases: `post_tweet`, `social_tweet`, `tweet`)
Publish content to a social platform.
- **Arguments**:
  - `text` (*string*, required; aliases: `content`, `tweet`): Post text content.
  - `platform` (*string*, optional, default `"threads"`; alias: `target`): Target platform.
  - `media` (*string*, optional; aliases: `media_path`, `image`): Path to media file.
  - `title` (*string*, optional): Post title (for Reddit).
  - `subreddit` (*string*, optional; alias: `sub`): Target subreddit (for Reddit).

### `social_reply` (aliases: `reply_tweet`, `social_comment`)
Post a reply to an existing social media URL.
- **Arguments**:
  - `url` (*string*, required; aliases: `post_url`, `tweet_url`): URL of target post.
  - `text` (*string*, required; aliases: `content`, `reply`): Reply body.
  - `platform` (*string*, optional, default `"threads"`): Platform name.

### `social_like` (aliases: `like_tweet`, `like_post`)
Like or upvote a social post.
- **Arguments**:
  - `url` (*string*, required)
  - `platform` (*string*, optional, default `"threads"`)

### `social_search` (aliases: `search_social`, `search_tweets`)
Search keywords or topics on a social platform.
- **Arguments**:
  - `query` (*string*, required; alias: `q`): Search query.
  - `platform` (*string*, optional, default `"threads"`)
  - `tab` (*string*, optional, default `"latest"`): Search tab.
  - `subreddit` (*string*, optional): Subreddit filter.

### `social_screenshot` (alias: `social_see`)
Capture screenshot of active social browser tab.
- **Arguments**:
  - `platform` (*string*, optional, default `"threads"`)
  - `full` (*boolean*, optional, default `false`)
  - `annotate` (*boolean*, optional, default `false`)

### `social_dedup_check` (alias: `social_check`)
Verify whether an action (e.g. reply) has already been performed on a URL.
- **Arguments**:
  - `url` (*string*, required): Target post URL.
  - `action` (*string*, required): Action identifier (e.g. `"reply"`, `"like"`).
  - `platform` (*string*, optional, default `"threads"`)

### `social_log` (alias: `social_log_action`)
Record an action in the persistent deduplication ledger.
- **Arguments**:
  - `url` (*string*, required)
  - `action` (*string*, required)
  - `status` (*string*, optional, default `"success"`)
  - `note` (*string*, optional)
  - `platform` (*string*, optional, default `"threads"`)

### `social_agent_task` (aliases: `social_task`, `social_mission`)
Run an autonomous social browser mission.
- **Arguments**:
  - `prompt` (*string*, required; alias: `task`): Mission instructions.
  - `model` (*string*, optional): LLM model name.
  - `timeout` (*number*, optional, default `300.0`): Timeout in seconds.

### `social_workflow` (alias: `workflow`)
Control background automated workflows.
- **Arguments**:
  - `action` (*string*, optional, default `"list"`): `"list"`, `"status"`, `"run"`, `"start"`, `"stop"`, `"daemon"`, `"history"`.
  - `id` (*string*, optional; alias: `workflow_id`): Workflow ID.

### `social_exec` (alias: `social_ab`)
Low-level agent-browser command dispatch to a platform session.
- **Arguments**:
  - `command` (*string*, required; alias: `cmd`): CLI command string.
  - `platform` (*string*, optional, default `"threads"`)
  - `timeout` (*number*, optional, default `35.0`)

### `social_doctor` (alias: `social_health`)
Audit LocoAgent Chrome profiles, port availability, and dependencies.
- **Arguments**: `{}`
