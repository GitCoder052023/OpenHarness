import type { Request, Response, NextFunction } from "express";
import type { ExecutionService } from "../services/execution.service.js";
import type { ApiExecuteRequest } from "../types/api.js";
import { ApiError } from "../errors/api-error.js";

export class ExecuteController {
  constructor(private readonly executionService: ExecutionService) {}

  public execute = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        throw ApiError.badRequest("Request body must be a JSON object");
      }

      const { tool, args } = req.body as Partial<ApiExecuteRequest>;

      if (typeof tool !== "string" || tool.trim().length === 0) {
        throw ApiError.badRequest("Field 'tool' must be a non-empty string");
      }

      if (
        args !== undefined &&
        (typeof args !== "object" || args === null || Array.isArray(args))
      ) {
        throw ApiError.badRequest("Field 'args' must be an object");
      }

      const canonicalRequest: ApiExecuteRequest = {
        tool: tool.trim(),
        args: (args as Record<string, unknown>) ?? {},
      };

      const workerResponse = await this.executionService.executeTool(
        canonicalRequest
      );

      if (workerResponse.status === "error") {
        res.json({
          status: "error",
          tool: canonicalRequest.tool,
          error: workerResponse.error || "Execution failed",
          ...(workerResponse.result !== undefined && workerResponse.result !== null
            ? { result: workerResponse.result }
            : {}),
        });
        return;
      }

      res.json({
        status: "ok",
        tool: canonicalRequest.tool,
        result: workerResponse.result,
      });
    } catch (err) {
      next(err);
    }
  };
}
