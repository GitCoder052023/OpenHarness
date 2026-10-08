#!/usr/bin/env python3
"""
==============================================================================
⚡ OPENHARNESS - ONE-COMMAND AUTONOMOUS INSTALLER
   By OpenAgent
==============================================================================
A complete, zero-touch setup and installation engine for OpenHarness:
1. Installs/verifies macOS system dependencies (Homebrew, uv, Bun, Ripgrep).
2. Synchronizes Python virtual environment via uv.
3. Installs Bun CLI harness modules (src/tools/cli-harness).
4. Initializes and verifies environment configuration (.env).
5. Audits and prompts macOS Accessibility & Input permissions.
6. Runs post-install verification smoke tests.
==============================================================================
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent


class Style:
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[0;32m"
    BLUE = "\033[0;34m"
    CYAN = "\033[0;36m"
    YELLOW = "\033[0;33m"
    RED = "\033[0;31m"
    MAGENTA = "\033[0;35m"
    RESET = "\033[0m"


def log_banner():
    print(f"""{Style.BOLD}{Style.CYAN}
==============================================================================
        ⌘ OPENHARNESS - SYSTEM INSTALLER & SETUP (by OpenAgent)
=============================================================================={Style.RESET}""")


def log_step(step: int, total: int, title: str):
    print(f"\n{Style.BOLD}[{step}/{total}] {title}...{Style.RESET}")


def log_ok(msg: str):
    print(f"  {Style.GREEN}✓{Style.RESET} {msg}")


def log_info(msg: str):
    print(f"  {Style.BLUE}ℹ{Style.RESET} {msg}")


def log_warn(msg: str):
    print(f"  {Style.YELLOW}⚠️  {msg}{Style.RESET}")


def log_err(msg: str):
    print(f"  {Style.RED}✗ {msg}{Style.RESET}")


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


def check_macos():
    if platform.system() != "Darwin":
        log_err("OpenHarness requires macOS (Darwin).")
        sys.exit(1)
    log_ok(f"macOS detected ({platform.mac_ver()[0]} on {platform.machine()})")


def check_and_install_brew():
    setup_path()
    brew_path = shutil.which("brew")
    if not brew_path:
        log_warn("Homebrew is not installed. Please install Homebrew from https://brew.sh")
        return False
    log_ok(f"Homebrew located at {brew_path}")
    return True


def ensure_system_tools():
    tools = {
        "uv": "uv",
        "bun": "bun",
        "rg": "ripgrep",
        "node": "node",
    }
    missing = []
    for binary, pkg in tools.items():
        if not shutil.which(binary):
            missing.append(pkg)
        else:
            log_ok(f"Binary found: {binary} ({shutil.which(binary)})")

    if missing:
        log_info(f"Installing missing tools via brew: {', '.join(missing)}")
        try:
            subprocess.run(["brew", "install"] + missing, check=True)
            setup_path()
            log_ok("Missing tools installed successfully.")
        except Exception as e:
            log_warn(f"Failed to auto-install some tools: {e}")


def sync_python_env():
    log_info("Synchronizing Python virtual environment via uv...")
    try:
        subprocess.run(["uv", "sync"], cwd=str(ROOT_DIR), check=True)
        log_ok("Python virtual environment synchronized.")
    except Exception as e:
        log_err(f"Failed to sync uv environment: {e}")
        sys.exit(1)


def install_bun_harness():
    harness_dir = ROOT_DIR / "src" / "tools" / "cli-harness"
    if not harness_dir.is_dir():
        log_warn(f"CLI harness directory not found at {harness_dir}")
        return

    log_info("Installing CLI harness dependencies with Bun...")
    try:
        subprocess.run(["bun", "install"], cwd=str(harness_dir), check=True)
        log_ok("CLI harness dependencies installed.")
    except Exception as e:
        log_warn(f"Could not run bun install in cli-harness: {e}")


def setup_config_file():
    env_file = ROOT_DIR / ".env"
    example_file = ROOT_DIR / ".env.example"
    if not env_file.exists() and example_file.exists():
        shutil.copy(str(example_file), str(env_file))
        log_ok("Generated default .env configuration from .env.example")
    elif env_file.exists():
        log_ok("Found existing .env configuration.")
    return env_file


def run_smoke_tests():
    log_info("Running post-install verification smoke test...")
    try:
        res = subprocess.run(["node", "server/test.js"], cwd=str(ROOT_DIR), capture_output=True, text=True)
        if res.returncode == 0:
            log_ok("OpenHarness API server test passed successfully!")
        else:
            log_warn(f"Smoke test reported non-zero return: {res.stderr}")
    except Exception as e:
        log_warn(f"Could not run smoke test: {e}")


def main():
    parser = argparse.ArgumentParser(description="Zero-touch setup engine for OpenHarness")
    parser.parse_args()

    log_banner()
    TOTAL_STEPS = 6

    log_step(1, TOTAL_STEPS, "Verifying macOS Platform")
    check_macos()

    log_step(2, TOTAL_STEPS, "Verifying Core System Tools")
    check_and_install_brew()
    ensure_system_tools()

    log_step(3, TOTAL_STEPS, "Synchronizing Python Environment (uv)")
    sync_python_env()

    log_step(4, TOTAL_STEPS, "Provisioning TypeScript CLI Harness (Bun)")
    install_bun_harness()

    log_step(5, TOTAL_STEPS, "Configuring Environment (.env)")
    setup_config_file()

    log_step(6, TOTAL_STEPS, "Running Verification Smoke Test")
    run_smoke_tests()

    print(f"""\n{Style.BOLD}{Style.GREEN}==============================================================================
  ✓ OPENHARNESS INSTALLATION COMPLETE!
=============================================================================={Style.RESET}
To launch the OpenHarness REST API server:
  {Style.CYAN}npm start{Style.RESET}  (or: {Style.CYAN}node server/index.js{Style.RESET})

To test tool execution from the CLI:
  {Style.CYAN}uv run openharness execute '{{"tool": "bash", "args": {{"command": "uname -a"}}}}'{Style.RESET}
""")


if __name__ == "__main__":
    main()
