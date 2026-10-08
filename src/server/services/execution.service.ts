import type { WorkerClient } from "../transport/worker-client.js";
import type { ApiExecuteRequest, WorkerResponse } from "../types/api.js";
import { ApiError } from "../errors/api-error.js";

export class ExecutionService {
  constructor(private readonly workerClient: WorkerClient) {}

  public async executeTool(
    request: ApiExecuteRequest,
    timeoutMs?: number
  ): Promise<WorkerResponse> {
    if (!this.workerClient.isReady()) {
      throw ApiError.serviceUnavailable("OpenHarness worker is unavailable");
    }

    try {
      const response = await this.workerClient.execute(
        {
          tool: request.tool,
          args: request.args ?? {},
        },
        timeoutMs
      );

      return response;
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("timed out")) {
          throw ApiError.internal(err.message);
        }
        if (err.message.includes("unavailable") || err.message.includes("not available")) {
          throw ApiError.serviceUnavailable("OpenHarness worker is unavailable");
        }
      }
      throw err;
    }
  }
}
