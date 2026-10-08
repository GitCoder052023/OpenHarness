import {
  DEFAULT_API_URL,
  DEFAULT_TIMEOUT_MS,
} from "../config/mcp-config.js";
import {
  ApiUnavailableError,
  ApiTimeoutError,
  ApiHttpError,
  ApiMalformedResponseError,
  OpenHarnessConnectorError,
} from "../errors/mcp-error.js";
import type { ApiExecuteRequest, ApiExecuteResponse } from "../types/mcp.js";

export interface OpenHarnessApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class OpenHarnessApiClient {
  public readonly baseUrl: string;
  public readonly timeoutMs: number;

  constructor(options: OpenHarnessApiClientOptions = {}) {
    const rawUrl = options.baseUrl || DEFAULT_API_URL;
    this.baseUrl = rawUrl.trim().replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public async executeTool(
    tool: string,
    args: Record<string, unknown> = {}
  ): Promise<ApiExecuteResponse> {
    const endpoint = `${this.baseUrl}/api/execute`;
    const payload: ApiExecuteRequest = { tool, args };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new ApiTimeoutError(this.timeoutMs);
      }

      if (this.isConnectionError(err)) {
        throw new ApiUnavailableError(this.baseUrl, err);
      }

      if (err instanceof OpenHarnessConnectorError) {
        throw err;
      }

      const message = err instanceof Error ? err.message : String(err);
      throw new OpenHarnessConnectorError(`Network request failed: ${message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    let parsedJson: unknown;
    try {
      parsedJson = await response.json();
    } catch (jsonErr) {
      if (!response.ok) {
        throw new ApiHttpError(
          response.status,
          response.statusText || "HTTP error"
        );
      }
      const message = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
      throw new ApiMalformedResponseError(
        `Failed to parse response as JSON: ${message}`
      );
    }

    if (!response.ok) {
      const errorMsg =
        parsedJson &&
        typeof parsedJson === "object" &&
        "error" in parsedJson &&
        typeof (parsedJson as { error: unknown }).error === "string"
          ? (parsedJson as { error: string }).error
          : response.statusText || "HTTP error";

      throw new ApiHttpError(response.status, errorMsg);
    }

    if (
      !parsedJson ||
      typeof parsedJson !== "object" ||
      Array.isArray(parsedJson) ||
      !("status" in parsedJson)
    ) {
      throw new ApiMalformedResponseError(
        "Response is missing expected 'status' property"
      );
    }

    return parsedJson as ApiExecuteResponse;
  }

  public async checkHealth(): Promise<{ status: string; worker: string }> {
    const endpoint = `${this.baseUrl}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiHttpError(
          response.status,
          `Health check failed with status ${response.status}`
        );
      }

      const body = (await response.json()) as { status: string; worker: string };
      return body;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new ApiTimeoutError(this.timeoutMs);
      }
      if (this.isConnectionError(err)) {
        throw new ApiUnavailableError(this.baseUrl, err);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isConnectionError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const cause = (err as Error & { cause?: { code?: string; message?: string } })
      .cause;
    const code = (err as { code?: string }).code || cause?.code;
    const message = err.message || "";
    const causeMessage = cause?.message || "";

    return (
      code === "ECONNREFUSED" ||
      code === "ENOTFOUND" ||
      code === "ECONNRESET" ||
      code === "EHOSTUNREACH" ||
      message.includes("fetch failed") ||
      causeMessage.includes("ECONNREFUSED") ||
      causeMessage.includes("ENOTFOUND")
    );
  }
}
