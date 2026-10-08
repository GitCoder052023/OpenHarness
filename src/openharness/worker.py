"""Persistent JSON-RPC stdio worker for OpenHarness.

Used by the Node.js API server and other language runtimes to execute tools
at near-zero latency with persistent in-memory adapters.
"""

import json
import logging
import os
import sys
import time
from typing import Any, Dict

# Set up unbuffered stdout/stderr
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

from openharness.dispatcher import (
    execute_tool_call,
    get_default_harness,
    get_default_mac_adapter,
    get_default_browser_adapter,
    get_default_firecrawl_adapter,
    get_default_loco_adapter,
)

logger = logging.getLogger("openharness.worker")


def main():
    # Warm up harness and adapters in background / startup
    harness = get_default_harness()
    mac = get_default_mac_adapter()
    browser = get_default_browser_adapter()
    firecrawl = get_default_firecrawl_adapter()
    loco = get_default_loco_adapter()

    # Emit readiness signal to stderr
    sys.stderr.write("[OpenHarness Worker] Ready. Listening on stdin.\n")
    sys.stderr.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        req_id = None
        start_time = time.time()

        try:
            req = json.loads(line)
            req_id = req.get("id")

            # Health / ping check
            if req.get("action") == "ping":
                resp = {"id": req_id, "status": "ok", "result": "pong"}
            elif req.get("action") == "doctor":
                status = {
                    "harness": "ok" if harness is not None else "unavailable",
                    "mac_adapter": "ok" if mac is not None else "unavailable",
                    "browser_adapter": "ok" if browser is not None else "unavailable",
                    "firecrawl": "ok" if firecrawl is not None else "unavailable",
                    "locoagent": "ok" if loco is not None else "unavailable",
                }
                resp = {"id": req_id, "status": "ok", "result": status}
            else:
                # Tool execution request: {"id": "...", "tool": "...", "args": {...}}
                tool = req.get("tool")
                args = req.get("args", {})
                if not tool:
                    resp = {"id": req_id, "status": "error", "error": "Missing 'tool' parameter"}
                else:
                    call = {"tool": tool, "args": args}
                    result = execute_tool_call(
                        harness=harness,
                        call=call,
                        mac_adapter=mac,
                        browser_adapter=browser,
                        firecrawl_adapter=firecrawl,
                        loco_adapter=loco,
                    )
                    resp = {
                        "id": req_id,
                        "status": result.get("status", "ok"),
                        "tool": tool,
                        "result": result.get("result"),
                        "error": result.get("error"),
                        "duration_ms": int((time.time() - start_time) * 1000),
                    }
        except Exception as exc:
            logger.exception("Worker error processing request: %s", exc)
            resp = {
                "id": req_id,
                "status": "error",
                "error": str(exc),
                "duration_ms": int((time.time() - start_time) * 1000),
            }

        sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
