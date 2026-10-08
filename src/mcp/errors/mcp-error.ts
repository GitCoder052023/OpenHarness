export class OpenHarnessConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenHarnessConnectorError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ApiUnavailableError extends OpenHarnessConnectorError {
  constructor(
    public readonly apiUrl: string,
    public readonly originalCause?: unknown
  ) {
    super(
      `Could not connect to OpenHarness API at ${apiUrl}. Ensure the OpenHarness API server is running.`
    );
    this.name = "ApiUnavailableError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ApiTimeoutError extends OpenHarnessConnectorError {
  constructor(public readonly timeoutMs: number) {
    super(`Request to OpenHarness API timed out after ${timeoutMs}ms.`);
    this.name = "ApiTimeoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ApiHttpError extends OpenHarnessConnectorError {
  constructor(
    public readonly statusCode: number,
    public readonly apiError: string
  ) {
    super(`OpenHarness API returned HTTP ${statusCode}: ${apiError}`);
    this.name = "ApiHttpError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ApiMalformedResponseError extends OpenHarnessConnectorError {
  constructor(message: string) {
    super(`Malformed response from OpenHarness API: ${message}`);
    this.name = "ApiMalformedResponseError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class McpValidationError extends OpenHarnessConnectorError {
  constructor(message: string) {
    super(`Validation error: ${message}`);
    this.name = "McpValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
