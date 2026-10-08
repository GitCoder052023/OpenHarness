import path from "node:path";
import fs from "node:fs";

export interface ServerConfig {
  host: string;
  port: number;
  timeoutMs: number;
  pythonPath: string;
}

export function loadConfig(): ServerConfig {
  const host = process.env.OPENHARNESS_HOST || "0.0.0.0";
  const port = parseInt(process.env.OPENHARNESS_PORT || "8080", 10);
  const timeoutMs = parseInt(process.env.OPENHARNESS_TIMEOUT_MS || "120000", 10);

  let defaultPython = "python3";
  const venvPython = path.resolve(process.cwd(), ".venv/bin/python");
  if (fs.existsSync(venvPython)) {
    defaultPython = venvPython;
  }

  const pythonPath = process.env.OPENHARNESS_PYTHON || defaultPython;

  return {
    host,
    port: isNaN(port) ? 8080 : port,
    timeoutMs: isNaN(timeoutMs) ? 120000 : timeoutMs,
    pythonPath,
  };
}
