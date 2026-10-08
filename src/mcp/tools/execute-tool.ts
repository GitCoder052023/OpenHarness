import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { OpenHarnessApiClient } from "../client/openharness-api-client.js";
import type { McpExecuteArgs, ValidationResult } from "../types/mcp.js";

export const OPENHARNESS_EXECUTE_TOOL_NAME = "openharness_execute";

export const OPENHARNESS_EXECUTE_TOOL_DESCRIPTION =
  "Execute an OpenHarness tool through the local OpenHarness API. " +
  "Execution is performed by the OpenHarness API server on the local machine. " +
  "Available capabilities (e.g., bash, read, write, edit, grep, glob, applescript, " +
  "macOS automation, browser control) depend on the OpenHarness installation. " +
  "The MCP connector serves strictly as a protocol adapter.";

export const OPENHARNESS_EXECUTE_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    tool: {
      type: "string",
      description:
        "The name of the OpenHarness tool to execute (e.g. bash, read, write, edit, grep, glob, applescript, system_info).",
    },
    args: {
      type: "object",
      description: "Optional key-value arguments for the tool.",
    },
  },
  required: ["tool"],
};

export function validateExecuteArgs(
  rawArgs: unknown
): ValidationResult<McpExecuteArgs> {
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    return {
      valid: false,
      error: "Arguments must be a JSON object",
    };
  }

  const { tool, args } = rawArgs as Record<string, unknown>;

  if (typeof tool !== "string" || tool.trim().length === 0) {
    return {
      valid: false,
      error: "Field 'tool' must be a non-empty string",
    };
  }

  if (
    args !== undefined &&
    (typeof args !== "object" || args === null || Array.isArray(args))
  ) {
    return {
      valid: false,
      error: "Field 'args' must be an object",
    };
  }

  return {
    valid: true,
    data: {
      tool: tool.trim(),
      args: (args as Record<string, unknown>) ?? {},
    },
  };
}

export async function executeToolHandler(
  apiClient: OpenHarnessApiClient,
  rawArgs: unknown
): Promise<CallToolResult> {
  const validation = validateExecuteArgs(rawArgs);
  if (!validation.valid) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Validation error: ${validation.error}`,
        },
      ],
    };
  }

  const { tool, args } = validation.data;

  try {
    const response = await apiClient.executeTool(tool, args);

    if (response.status === "error") {
      const errorMsg = response.error || "Tool execution failed";
      let text = `Tool '${tool}' execution failed: ${errorMsg}`;

      if ("result" in response && response.result !== undefined && response.result !== null) {
        const details =
          typeof response.result === "string"
            ? response.result
            : JSON.stringify(response.result, null, 2);
        text += `\n\nResult:\n${details}`;
      }

      return {
        isError: true,
        content: [
          {
            type: "text",
            text,
          },
        ],
        structuredContent:
          typeof response === "object" && response !== null
            ? (response as unknown as Record<string, unknown>)
            : undefined,
      };
    }

    const resultText =
      typeof response.result === "string"
        ? response.result
        : JSON.stringify(response.result, null, 2);

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: resultText,
        },
      ],
      ...(typeof response.result === "object" &&
      response.result !== null &&
      !Array.isArray(response.result)
        ? { structuredContent: response.result as Record<string, unknown> }
        : {}),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: message,
        },
      ],
    };
  }
}
