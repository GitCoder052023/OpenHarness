import type { McpConfig } from "../types/mcp.js";

export const DEFAULT_API_URL = "http://127.0.0.1:8080";
export const DEFAULT_TIMEOUT_MS = 120000;

export function loadMcpConfig(): McpConfig {
  const rawUrl = process.env.OPENHARNESS_API_URL || DEFAULT_API_URL;
  const rawTimeout =
    process.env.OPENHARNESS_MCP_TIMEOUT_MS || process.env.OPENHARNESS_TIMEOUT_MS;

  const timeoutMs = rawTimeout ? parseInt(rawTimeout, 10) : DEFAULT_TIMEOUT_MS;

  return {
    apiUrl: rawUrl.trim().replace(/\/+$/, ""),
    timeoutMs: isNaN(timeoutMs) || timeoutMs <= 0 ? DEFAULT_TIMEOUT_MS : timeoutMs,
  };
}
