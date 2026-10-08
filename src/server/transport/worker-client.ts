import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";
import path from "node:path";
import { EventEmitter } from "node:events";
import type {
  PendingRequest,
  WorkerRequest,
  WorkerResponse,
} from "../types/api.js";
import { logger } from "../utils/logger.js";

export interface WorkerClientOptions {
  pythonPath?: string;
  cwd?: string;
  defaultTimeoutMs?: number;
}

export class WorkerClient extends EventEmitter {
  private pythonPath: string;
  private cwd: string;
  private defaultTimeoutMs: number;
  private proc: ChildProcess | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isReadyState = false;
  private isShuttingDown = false;
  private seq = 0;

  constructor(options: WorkerClientOptions = {}) {
    super();
    this.cwd = options.cwd || process.cwd();
    this.pythonPath = options.pythonPath || "python3";
    this.defaultTimeoutMs = options.defaultTimeoutMs || 120000;
  }

  public isReady(): boolean {
    return this.isReadyState && this.proc !== null && !this.isShuttingDown;
  }

  public async start(): Promise<void> {
    if (this.proc) {
      return;
    }

    this.isShuttingDown = false;
    const srcDir = path.resolve(this.cwd, "src");

    return new Promise<void>((resolve, reject) => {
      logger.info(`Starting Python worker using ${this.pythonPath}...`);

      const env = {
        ...process.env,
        PYTHONPATH: process.env.PYTHONPATH
          ? `${srcDir}:${process.env.PYTHONPATH}`
          : srcDir,
        PYTHONUNBUFFERED: "1",
      };

      try {
        this.proc = spawn(this.pythonPath, ["-m", "openharness.worker"], {
          cwd: this.cwd,
          env,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err) {
        logger.error(`Failed to spawn worker process: ${err}`);
        reject(err);
        return;
      }

      let startupTimer: NodeJS.Timeout | null = null;
      let startupResolved = false;

      const onStartupTimeout = () => {
        if (!startupResolved) {
          startupResolved = true;
          logger.error("Timed out waiting for Python worker readiness signal");
          this.stop().catch(() => {});
          reject(new Error("Timeout waiting for worker process to initialize"));
        }
      };

      startupTimer = setTimeout(onStartupTimeout, 30000);

      const markReady = () => {
        if (!startupResolved) {
          startupResolved = true;
          if (startupTimer) {
            clearTimeout(startupTimer);
            startupTimer = null;
          }
          this.isReadyState = true;
          logger.info("Python worker is ready");
          resolve();
        }
      };

      if (!this.proc.stdout || !this.proc.stdin || !this.proc.stderr) {
        if (startupTimer) clearTimeout(startupTimer);
        reject(new Error("Worker stdio pipes are unavailable"));
        return;
      }

      const rl = readline.createInterface({
        input: this.proc.stdout,
        crlfDelay: Infinity,
      });

      rl.on("line", (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        this.handleStdoutLine(trimmed);
      });

      this.proc.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        logger.debug(`[Worker stderr] ${text.trim()}`);
        if (text.includes("[OpenHarness Worker] Ready")) {
          markReady();
        }
      });

      this.proc.on("error", (err: Error) => {
        logger.error(`Worker process error: ${err.message}`);
        if (!startupResolved) {
          startupResolved = true;
          if (startupTimer) clearTimeout(startupTimer);
          reject(err);
        }
        this.handleProcessExit(-1, "ERROR");
      });

      this.proc.on("exit", (code: number | null, signal: string | null) => {
        if (!startupResolved) {
          startupResolved = true;
          if (startupTimer) clearTimeout(startupTimer);
          reject(
            new Error(`Worker exited before readiness (code ${code}, signal ${signal})`)
          );
        }
        this.handleProcessExit(code, signal);
      });
    });
  }

  private handleStdoutLine(line: string): void {
    try {
      const response: WorkerResponse = JSON.parse(line);
      const { id } = response;
      if (!id) {
        logger.warn(`Received worker message without ID: ${line}`);
        return;
      }

      const pending = this.pendingRequests.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(id);
        pending.resolve(response);
      } else {
        logger.debug(`No pending request found for ID: ${id}`);
      }
    } catch (err) {
      logger.warn(`Failed to parse worker response JSON: ${line}`, err);
    }
  }

  private handleProcessExit(
    code: number | null,
    signal: string | null
  ): void {
    const wasShuttingDown = this.isShuttingDown;
    this.isReadyState = false;
    this.proc = null;

    if (!wasShuttingDown) {
      logger.error(
        `Worker process crashed/exited unexpectedly (code: ${code}, signal: ${signal})`
      );
    } else {
      logger.info("Worker process exited cleanly");
    }

    const error = new Error("Worker process is unavailable");
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();

    this.emit("exit", { code, signal, expected: wasShuttingDown });
  }

  public async execute(
    request: Omit<WorkerRequest, "id">,
    timeoutMs?: number
  ): Promise<WorkerResponse> {
    if (!this.isReady() || !this.proc || !this.proc.stdin) {
      throw new Error("Worker is not available");
    }

    const effectiveTimeout = timeoutMs || this.defaultTimeoutMs;
    const id = `req_${Date.now()}_${++this.seq}_${Math.random().toString(36).substring(2, 7)}`;
    const fullRequest: WorkerRequest = {
      id,
      ...request,
    };

    return new Promise<WorkerResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new Error(`Worker request timed out after ${effectiveTimeout}ms`)
        );
      }, effectiveTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        const payload = JSON.stringify(fullRequest) + "\n";
        this.proc!.stdin!.write(payload, "utf-8", (err) => {
          if (err) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    this.isReadyState = false;

    if (!this.proc) {
      return;
    }

    logger.info("Stopping Python worker process...");

    const child = this.proc;
    this.proc = null;

    return new Promise<void>((resolve) => {
      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const forceKillTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
        finish();
      }, 3000);

      child.once("exit", () => {
        clearTimeout(forceKillTimer);
        finish();
      });

      try {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.end();
        }
        child.kill("SIGTERM");
      } catch {
        finish();
      }
    });
  }
}
