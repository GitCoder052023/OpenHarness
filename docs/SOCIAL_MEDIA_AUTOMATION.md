# 🌐 Social Media Automation with LocoAgent — OpenHarness (by OpenAgent)

OpenHarness natively integrates the **LocoAgent** engine to give external intelligence (Claude, Gemini, OpenAI / Codex, DeepSeek, local LLMs, or any autonomous agent) full autonomous capability to operate and automate personal social media accounts directly from macOS.

> **Primary Focus**: **Threads** (`threads.net`) and **Reddit** (`reddit.com`).  
> Secondary supported platforms include X/Twitter, LinkedIn, Instagram, Facebook, YouTube, TikTok, and GitHub.

---

### 🎯 Supported Social Media Platforms & CDP Profiles

Agents operate accounts through **real Google Chrome browser instances via Chrome DevTools Protocol (CDP)** with isolated cookie and session storage. This bypasses anti-bot detection because you are driving genuine, authenticated desktop Chrome windows without touching your everyday browser.

| Platform | Domain | Default CDP Port | Profile Directory (macOS) | Verified Account / Status | Priority |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **Threads** | `threads.net` | `9227` | `~/Library/Application Support/locoagent-chrome-profile-threads` | `@hamdankhubaib.code` (Authenticated) | **Primary (Default)** |
| **Reddit** | `reddit.com` | `9224` | `~/Library/Application Support/locoagent-chrome-profile-reddit` | Active (Joined Tech Subreddits) | **Primary** |
| **X (Twitter)** | `x.com` | `9222` | `~/Library/Application Support/locoagent-chrome-profile-x` | Ready | Secondary |
| **LinkedIn** | `linkedin.com` | `9223` | `~/Library/Application Support/locoagent-chrome-profile-linkedin` | Ready | Secondary |
| **Instagram** | `instagram.com` | `9225` | `~/Library/Application Support/locoagent-chrome-profile-instagram` | Ready | Secondary |
| **Facebook** | `facebook.com` | `9226` | `~/Library/Application Support/locoagent-chrome-profile-facebook` | Ready | Secondary |
| **YouTube** | `youtube.com` | `9228` | `~/Library/Application Support/locoagent-chrome-profile-youtube` | Ready | Secondary |
| **TikTok** | `tiktok.com` | `9229` | `~/Library/Application Support/locoagent-chrome-profile-tiktok` | Ready | Secondary |
| **GitHub** | `github.com` | `9230` | `~/Library/Application Support/locoagent-chrome-profile-github` | Ready | Secondary |

*(Note: On Linux, profiles live under `~/.local/share/locoagent-chrome-profile-<platform>`; on Windows, `%LOCALAPPDATA%\locoagent-chrome-profile-<platform>`.)*

---

## 💡 How Autonomous Agents Operate Social Media via OpenHarness

A common question is: *how can an external AI model reliably operate personal social media via tool calls alone?*

1. **Persistent Authentication (Zero Friction)**:
   - You log in manually **once** into the dedicated profile.
   - Sessions, cookies, and local storage remain saved on your Mac permanently. The AI never handles or asks for your passwords.
2. **Deterministic CDP Perception (`agent-browser`)**:
   - The AI doesn't guess pixel coordinates.
   - When an agent calls `social_post` or `social_reply`, OpenHarness takes an accessibility snapshot with `@e` element IDs (e.g. `@e12 [textbox "What's new?"]`, `@e15 [button "Post"]`).
   - OpenHarness executes atomic CDP actions (`open`, `snapshot`, `fill`, `click`).
3. **Anti-Duplication Ledger**:
   - Every like, upvote, reply, and post is hashed and stored in `persona/operation-log.json`.
   - Before any action executes, OpenHarness checks if the target post URL was already touched. Duplicate spamming is blocked automatically.
4. **Visual Verification Delivered in Tool Response**:
   - Every published thread, post, or reply captures an automatic screenshot from the live Chrome window and returns the path directly in the tool response for verification.

---

## 🚀 One-Time Setup: Logging Into Your Accounts

Launch isolated Chrome windows to seed logins:

```bash
cd src/tools/locoagent

# 1. Setup your primary channels
bun run setup-chrome --target threads   # Launches Chrome on port 9227 -> Log into threads.net
bun run setup-chrome --target reddit    # Launches Chrome on port 9224 -> Log into reddit.com

# 2. Or launch all platforms at once
bun run setup-chrome --all
```

Log in manually in the browser windows. Your logins are saved indefinitely in `~/Library/Application Support/locoagent-chrome-profile-<target>`. Once logged in, Chrome can remain running or be auto-launched by OpenHarness whenever needed.

---

## 🛠️ Social Tools in OpenHarness

Agents invoke these tools via the OpenHarness REST API (`POST /execute`), CLI (`openharness execute`), or direct stdio worker:

### 1. Threads Operations (Default)
- **Publish a Thread**:
  ```json
  {"tool": "social_post", "args": {"platform": "threads", "text": "Building autonomous AI agent bridges with OpenHarness. Seamless CDP control feels like magic."}}
  ```
  *(Captures screenshot and returns confirmation)*
- **Reply to a Thread**:
  ```json
  {"tool": "social_reply", "args": {"platform": "threads", "url": "https://www.threads.net/@user/post/xyz", "text": "Spot on. Latency optimization is key for local agent loops."}}
  ```
- **Like a Thread**:
  ```json
  {"tool": "social_like", "args": {"platform": "threads", "url": "https://www.threads.net/@user/post/xyz"}}
  ```
- **Search Threads**:
  ```json
  {"tool": "social_search", "args": {"platform": "threads", "query": "autonomous agents"}}
  ```

### 2. Reddit Operations
- **Submit a Post to a Subreddit**:
  ```json
  {"tool": "social_post", "args": {
    "platform": "reddit",
    "subreddit": "LocalLLaMA",
    "title": "Benchmarking low-latency streaming bridges for local models",
    "text": "Hey everyone, wanted to share our architecture for local agent-driven CDP automation..."
  }}
  ```
- **Upvote a Reddit Post or Comment**:
  ```json
  {"tool": "social_like", "args": {"platform": "reddit", "url": "https://www.reddit.com/r/LocalLLaMA/comments/123/benchmarks"}}
  ```
  *(Translates to Reddit Upvote button and records in ledger)*
- **Comment on a Reddit Discussion**:
  ```json
  {"tool": "social_reply", "args": {
    "platform": "reddit",
    "url": "https://www.reddit.com/r/LocalLLaMA/comments/123/benchmarks",
    "text": "Great breakdown. We observed similar results with quantization on M-series chips."
  }}
  ```
- **Search Subreddit**:
  ```json
  {"tool": "social_search", "args": {"platform": "reddit", "subreddit": "LocalLLaMA", "query": "agent browser"}}
  ```

### 3. Workflows & Background Daemons
- `social_workflow`: Manage automated pipelines:
  - `list`: View registered workflows:
    - `reddit-tech-digest`: Scans `r/LocalLLaMA` and `r/artificial`, dedups, and compiles daily digest.
    - `threads-post-update`: Publishes builder reflections directly to Meta Threads.
    - `hf-papers-to-x`: Posts HuggingFace daily paper highlights.
    - `x-search-reply`: Searches and engages on X.
    - `linkedin-search-reply`: Monitors and comments on LinkedIn.
  - `run`: Run a workflow synchronously (`{"action": "run", "id": "reddit-tech-digest"}`).
  - `daemon`: Schedule recurring execution (`{"action": "daemon", "id": "reddit-tech-digest", "interval": 120}`).
  - `stop`: Halt a running daemon (`{"action": "stop", "id": "reddit-tech-digest"}`).
  - `status`: Inspect run history and last result.

### 4. Autonomous Missions & Direct CDP Exec
- `social_agent_task`: Delegate high-level goals to LocoAgent's internal agentic loop:
  ```json
  {"tool": "social_agent_task", "args": {"prompt": "Browse r/LocalLLaMA top posts today, find the highest signal discussion on local vision models, upvote it, and draft a summary."}}
  ```
- `social_exec`: Execute any raw `agent-browser` command on the target session:
  ```json
  {"tool": "social_exec", "args": {"platform": "threads", "command": "snapshot -i -c"}}
  ```

---

## 🎨 Persona & Anti-Bot Safeguards

1. **`persona/persona.md`**:
   - Defines technical tone of voice, formatting guidelines, and no-spam rules.
2. **`persona/tasks.md`**:
   - Routine guidelines centered around Threads and Reddit.
3. **`persona/operation-log.json`**:
   - Persistent ledger ensuring no URL is liked, upvoted, or replied to more than once.
4. **Style Calibration**:
   - Agents can inspect past posts on Threads (`@hamdankhubaib.code`) and Reddit (`u/Quirky-Low-7500`) to extract and mirror authentic tone, vocabulary, and formatting rather than choosing a generic style.
