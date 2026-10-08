import type { Request, Response } from "express";
import type { WorkerClient } from "../transport/worker-client.js";

export class HealthController {
  constructor(private readonly workerClient: WorkerClient) {}

  public getHealth = (_req: Request, res: Response): void => {
    res.json({
      status: "ok",
      worker: this.workerClient.isReady() ? "ready" : "unavailable",
    });
  };

  public getRoot = (_req: Request, res: Response): void => {
    res.json({
      name: "OpenHarness API",
      status: "ok",
    });
  };
}
