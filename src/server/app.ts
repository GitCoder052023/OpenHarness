import express, { type Express } from "express";
import { WorkerClient } from "./transport/worker-client.js";
import { ExecutionService } from "./services/execution.service.js";
import { HealthController } from "./controllers/health.controller.js";
import { ExecuteController } from "./controllers/execute.controller.js";
import { createHealthRoutes } from "./routes/health.routes.js";
import { createExecuteRoutes } from "./routes/execute.routes.js";
import { errorHandler } from "./errors/error-handler.js";
import { ApiError } from "./errors/api-error.js";

export interface AppDependencies {
  workerClient: WorkerClient;
  executionService?: ExecutionService;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  const executionService =
    deps.executionService || new ExecutionService(deps.workerClient);
  const healthController = new HealthController(deps.workerClient);
  const executeController = new ExecuteController(executionService);

  app.use("/", createHealthRoutes(healthController));
  app.use("/api", createExecuteRoutes(executeController));

  // 404 handler for unknown routes
  app.use((_req, _res, next) => {
    next(ApiError.notFound("Route not found"));
  });

  // Central error handling middleware
  app.use(errorHandler);

  return app;
}
