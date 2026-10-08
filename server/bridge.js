/**
 * OpenHarness Python Worker Bridge
 * By OpenAgent
 *
 * Spawns and manages a persistent child process running python -m openharness.worker
 * Communicates over stdio JSON-RPC for sub-millisecond dispatch latency.
 */

import { spawn } from "node:child_process"
import readline from "node:readline"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, "..")

export class HarnessBridge {
  constructor(options = {}) {
    this.repoRoot = options.repoRoot || REPO_ROOT
    this.proc = null
    this.rl = null
    this.seq = 0
    this.pending = new Map()
    this.ready = false
    this.starting = false
    this.startPromise = null
  }

  async start() {
    if (this.ready && this.proc) return
    if (this.starting) return this.startPromise

    this.starting = true
    this.startPromise = new Promise((resolve, reject) => {
      try {
        const env = {
          ...process.env,
          PYTHONPATH: path.join(this.repoRoot, "src") + (process.env.PYTHONPATH ? ":" + process.env.PYTHONPATH : ""),
        }

        // Try 'uv run python -m openharness.worker', fallback to 'python3 -m openharness.worker'
        const hasUv = true
        const cmd = hasUv ? "uv" : "python3"
        const args = hasUv
          ? ["run", "python", "-m", "openharness.worker"]
          : ["-m", "openharness.worker"]

        this.proc = spawn(cmd, args, {
          cwd: this.repoRoot,
          env,
          stdio: ["pipe", "pipe", "pipe"],
        })

        this.rl = readline.createInterface({
          input: this.proc.stdout,
          crlfDelay: Infinity,
        })

        this.rl.on("line", (line) => {
          this._handleLine(line)
        })

        this.proc.stderr.on("data", (data) => {
          const str = data.toString()
          if (str.includes("[OpenHarness Worker] Ready")) {
            this.ready = true
            this.starting = false
            resolve()
          }
          // Log errors or info
          process.stderr.write(`[Worker] ${str}`)
        })

        this.proc.on("error", (err) => {
          console.error("[Worker Process Error]", err)
          this.ready = false
          this.starting = false
          this._rejectAllPending(err)
          reject(err)
        })

        this.proc.on("exit", (code, signal) => {
          this.ready = false
          this.starting = false
          this._rejectAllPending(new Error(`Worker exited with code ${code} signal ${signal}`))
          this.proc = null
          this.rl = null
        })

        // Safety timeout for worker startup
        setTimeout(() => {
          if (!this.ready) {
            this.ready = true // Assume ready if no crash
            this.starting = false
            resolve()
          }
        }, 3000)
      } catch (err) {
        this.starting = false
        reject(err)
      }
    })

    return this.startPromise
  }

  _handleLine(line) {
    line = line.trim()
    if (!line) return
    try {
      const resp = JSON.parse(line)
      const id = resp.id
      if (id && this.pending.has(id)) {
        const { resolve, timer } = this.pending.get(id)
        clearTimeout(timer)
        this.pending.delete(id)
        resolve(resp)
      }
    } catch (err) {
      console.error("[Bridge Parse Error]", err, "line:", line)
    }
  }

  _rejectAllPending(err) {
    for (const [id, { reject, timer }] of this.pending.entries()) {
      clearTimeout(timer)
      reject(err)
    }
    this.pending.clear()
  }

  async execute(tool, args = {}, timeoutMs = 65000) {
    await this.start()

    this.seq += 1
    const id = `req_${this.seq}_${Date.now()}`
    const payload = JSON.stringify({ id, tool, args })

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`OpenHarness execution timed out after ${timeoutMs}ms for tool '${tool}'`))
        }
      }, timeoutMs)

      this.pending.set(id, { resolve, reject, timer })

      try {
        this.proc.stdin.write(payload + "\n")
      } catch (err) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(err)
      }
    })
  }

  async doctor(timeoutMs = 15000) {
    await this.start()
    this.seq += 1
    const id = `doc_${this.seq}_${Date.now()}`
    const payload = JSON.stringify({ id, action: "doctor" })

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`Doctor audit timed out after ${timeoutMs}ms`))
        }
      }, timeoutMs)

      this.pending.set(id, { resolve, reject, timer })
      this.proc.stdin.write(payload + "\n")
    })
  }

  close() {
    if (this.proc) {
      this.proc.kill("SIGTERM")
      this.proc = null
      this.rl = null
      this.ready = false
    }
  }
}

// Global default bridge singleton
let defaultBridge = null

export function getHarnessBridge() {
  if (!defaultBridge) {
    defaultBridge = new HarnessBridge()
  }
  return defaultBridge
}
