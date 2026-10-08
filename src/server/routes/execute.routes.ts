import { Router } from "express";
import type { ExecuteController } from "../controllers/execute.controller.js";

export function createExecuteRoutes(controller: ExecuteController): Router {
  const router = Router();

  router.post("/execute", controller.execute);

  return router;
}
