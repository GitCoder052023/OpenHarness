export interface ApiExecuteRequest {
  tool: string;
  args?: Record<string, unknown>;
}

export type ApiExecuteResponse =
  | {
      status: "ok";
      tool: string;
      result: unknown;
    }
  | {
      status: "error";
      tool: string;
      error: string;
      result?: unknown;
    }
  | {
      status: "error";
      error: string;
    };

export interface McpExecuteArgs {
  tool: string;
  args?: Record<string, unknown>;
}

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string };

export interface McpConfig {
  apiUrl: string;
  timeoutMs: number;
}
