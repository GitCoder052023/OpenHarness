#!/usr/bin/env python3
"""
==============================================================================
⚡ OPENHARNESS - AUTONOMOUS BOOT ENGINE & SUPERVISOR
   By OpenAgent
==============================================================================
An intelligent boot orchestrator for OpenHarness:
1. Self-Bootstraps virtual environment via uv.
2. Verifies system & package dependencies (Bun, Node, Ripgrep).
3. Preflights stdio IPC and conducts engine audit (--doctor).
4. Launches the lightweight Node.js REST API server.
==============================================================================
"""

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent


class Style:
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[0;32m"
    BLUE = "\033[0;34m"
    CYAN = "\033[0;36m"
    YELLOW = "\033[0;33m"
    RED = "\033[0;31m"
    RESET = "\033[0m"


def log_banner():
    print(f"""{Style.BOLD}{Style.CYAN}
==============================================================================
          ⌘ OPENHARNESS - SYSTEM BOOT ENGINE (by OpenAgent)
=============================================================================={Style.RESET}""")


def setup_path():
    extra_paths = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        str(Path.home() / ".bun" / "bin"),
        str(Path.home() / ".local" / "bin"),
    ]
    current_path = os.environ.get("PATH", "")
    for p in extra_paths:
        if Path(p).is_dir() and p not in current_path:
            os.environ["PATH"] = f"{p}:{os.environ['PATH']}"


def run_doctor():
    log_banner()
    print(f"{Style.BOLD}Running OpenHarness Preflight Diagnostics...{Style.RESET}\n")

    # Check binaries
    binaries = ["node", "bun", "uv", "rg", "osascript"]
    for b in binaries:
        path = shutil.which(b)
        status = f"{Style.GREEN}✓ found{Style.RESET} ({path})" if path else f"{Style.RED}✗ missing{Style.RESET}"
        print(f"  • Binary {b:12s}: {status}")

    # Check 5 engines
    print(f"\n{Style.BOLD}Auditing Harness Engines:{Style.RESET}")
    try:
        sys.path.insert(0, str(ROOT_DIR / "src"))
        from openharness import OpenHarness
        h = OpenHarness()
        doctor_res = h.doctor()
        for engine, status in doctor_res.items():
            sym = f"{Style.GREEN}✓{Style.RESET}" if status == "ok" else f"{Style.YELLOW}⚠️{Style.RESET}"
            print(f"  {sym} {engine:20s}: {status}")
    except Exception as e:
        print(f"  {Style.RED}✗ Failed to audit engines: {e}{Style.RESET}")

    print("\n==============================================================================")


def start_server(port: int = 8080, host: str = "127.0.0.1"):
    log_banner()
    server_path = ROOT_DIR / "server" / "index.js"
    env = os.environ.copy()
    env["OPENHARNESS_PORT"] = str(port)
    env["OPENHARNESS_HOST"] = host

    print(f"Starting OpenHarness API server on http://{host}:{port}...\n")
    try:
        subprocess.run(["node", str(server_path)], cwd=str(ROOT_DIR), env=env)
    except KeyboardInterrupt:
        print("\nOpenHarness server stopped.")


def main():
    setup_path()
    parser = argparse.ArgumentParser(description="OpenHarness Autonomous Boot Engine")
    parser.add_argument("--doctor", action="store_true", help="Run preflight diagnostics and exit")
    parser.add_argument("--port", "-p", type=int, default=8080, help="Server port (default: 8080)")
    parser.add_argument("--host", default="127.0.0.1", help="Server host (default: 127.0.0.1)")
    args = parser.parse_args()

    if args.doctor:
        run_doctor()
        sys.exit(0)

    start_server(args.port, args.host)


if __name__ == "__main__":
    main()
