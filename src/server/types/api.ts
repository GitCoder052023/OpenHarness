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

export interface WorkerRequest {
  id: string;
  tool?: string;
  args?: Record<string, unknown>;
  action?: string;
}

export interface WorkerResponse {
  id: string;
  status: "ok" | "error";
  tool?: string;
  result?: unknown;
  error?: string | null;
  duration_ms?: number;
}

export interface PendingRequest {
  resolve: (value: WorkerResponse) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}
