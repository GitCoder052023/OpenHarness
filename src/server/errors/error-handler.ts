import type { Request, Response, NextFunction } from "express";
import { ApiError } from "./api-error.js";
import { logger } from "../utils/logger.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error(`API Error [${err.statusCode}]: ${err.message}`);
    }
    res.status(err.statusCode).json({
      status: "error",
      error: err.message,
    });
    return;
  }

  // Handle malformed JSON body from express.json()
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      status: "error",
      error: "Invalid JSON body",
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error(`Unexpected Error: ${message}`);

  res.status(500).json({
    status: "error",
    error: message,
  });
}
