# Security Policy — OpenHarness (by OpenAgent)

OpenHarness connects external AI models, agents, and client systems (such as Claude, Gemini, OpenAI / Codex, DeepSeek, or local LLMs) to a local macOS execution environment. Because OpenHarness enables shell execution, filesystem modification, application control, browser automation via CDP, and GUI interaction, security and fail-closed behavior are core architectural requirements.

> [!WARNING]
> ## AI Computer-Use Security & Liability
>
> **Giving an AI agent access to your computer inherently introduces security and privacy risks.**
>
> OpenHarness can perform actions with the privileges of the local user account, including executing commands, modifying files, interacting with applications, controlling browser sessions, and operating the GUI.
>
> AI agents can make mistakes. Bugs, unexpected model behavior, prompt injection, malicious instructions, or misconfiguration may result in unintended actions, data loss, privacy incidents, or other damage.
>
> **OpenHarness is provided "AS IS" and "AS AVAILABLE".** To the maximum extent permitted by applicable law, the maintainers and contributors are **not liable for losses, damages, data loss, privacy incidents, or other consequences resulting from the use or misuse of OpenHarness.**
>
> You are responsible for deciding whether to run OpenHarness, what permissions to grant it, and what data or accounts are accessible to it.
>
> **Never run an autonomous computer-use agent in an environment where an unintended action could cause unacceptable damage or loss.**

---

## Supported Versions

OpenHarness is currently in active development. Security fixes are provided for the latest version on the `main` branch.

| Version | Supported |
| :--- | :--- |
| `0.1.x` (main branch) | :white_check_mark: |
| `< 0.1.0` | :x: |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public issues.**

Instead:

- Open a private GitHub Security Advisory via **Security → Advisories → Report a vulnerability**.
- Or contact the maintainers directly through the [OpenAgent organization](https://github.com/GitCoder052023/OpenAgent).

Please include:

1. A description of the vulnerability and its impact.
2. Steps to reproduce or a minimal proof of concept.
3. A suggested remediation, if known.

We will acknowledge reports and work with the reporter to investigate and address confirmed issues before public disclosure where appropriate.

---

## Security Model

OpenHarness includes several architectural safeguards designed to reduce unintended execution:

### 1. Localhost Loopback Binding by Default

The OpenHarness Node.js API server binds strictly to `127.0.0.1` by default. It is not exposed to the local network or internet unless explicitly configured via `OPENHARNESS_HOST=0.0.0.0`.

### 2. Optional API Key Authentication

When exposing OpenHarness across local network boundaries, set the `OPENHARNESS_API_KEY` environment variable. All requests to `/execute`, `/tools`, and adapter endpoints will require:

```http
Authorization: Bearer <your-secret-api-key>
```

Requests without a matching key are immediately rejected with `401 Unauthorized`.

### 3. Configurable Target Isolation

The native macOS harness maintains a configurable `PROHIBITED_TARGETS` list.

If specific applications need to be restricted to prevent accidental interaction with sensitive processes (such as password managers or terminal windows running critical jobs), their bundle identifiers or process names can be added to `PROHIBITED_TARGETS`.

### 4. PID-Targeted Input

Mouse and keyboard events in the macOS adapter are posted directly to the target application's process where supported.

This allows background interaction without unnecessarily moving the user's physical cursor or stealing focus from the active window.

### 5. Deterministic CDP Profiles

Browser automation (Chrome CDP) runs in dedicated, isolated user data directories (`~/Library/Application Support/locoagent-chrome-profile-<platform>`). This keeps agent-driven web actions completely isolated from your daily personal browser sessions and passwords.

### 6. Fail-Closed Error Handling

If a tool call is malformed, targets an ambiguous element, or encounters an unexpected state, OpenHarness fails closed and returns a structured error rather than guessing or attempting arbitrary actions.

---

## User Responsibilities

When operating OpenHarness:

1. **Protect API endpoints.** Do not bind OpenHarness to public network interfaces without strict API key authentication and network firewalls.
2. **Grant permissions carefully.** macOS Accessibility, Input Monitoring, and Screen Recording permissions provide significant local capabilities. Only grant them to processes you trust.
3. **Do not run as root.** OpenHarness commands execute with the privileges of the current macOS user. Never run OpenHarness with `sudo`.
4. **Protect logs.** Operational logs may contain command outputs, file paths, and environment details. Review them before sharing externally.
5. **Protect sensitive environments.** Do not expose credentials, financial accounts, production infrastructure, or irreplaceable data unless you understand and accept the associated risks.

---

## Security Philosophy

OpenHarness follows a simple principle:

> **When execution is ambiguous or unsafe, fail closed rather than guess.**