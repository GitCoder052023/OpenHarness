#!/usr/bin/env python3
"""
==============================================================================
⚡ OPENHARNESS - COMPREHENSIVE TEST RUNNER
   By OpenAgent
==============================================================================
Runs and orchestrates all test suites, live harness checks, and API tests:
1. Unit test suite via pytest (tests/ - harness, adapters, dispatchers).
2. Live headless Bun harness stdio IPC verification.
3. Native macOS computer-use adapter verification (MacAdapter).
4. Real Browser CDP adapter verification (BrowserAdapter).
5. Node.js REST API Server test suite (server/test.js).
Outputs a clean visual test report dashboard with timing & exit codes.
==============================================================================
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

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


def get_venv_python() -> str:
    venv_py = ROOT_DIR / ".venv/bin/python"
    return str(venv_py) if venv_py.exists() else sys.executable


def run_unit_tests(verbose: bool = False) -> Tuple[bool, str, float]:
    """Runs the pytest unit test suite."""
    t0 = time.time()
    uv_bin = shutil.which("uv")
    cmd = [uv_bin, "run", "pytest", "-q"] if uv_bin else [get_venv_python(), "-m", "pytest", "-q"]
    if verbose:
        cmd.append("-v")

    res = subprocess.run(cmd, cwd=str(ROOT_DIR), capture_output=True, text=True)
    duration = time.time() - t0
    passed = res.returncode == 0
    output = (res.stdout + "\n" + res.stderr).strip()
    return passed, output, duration


def run_bun_harness_test() -> Tuple[bool, str, float]:
    """Verifies live Bun headless harness stdio IPC."""
    t0 = time.time()
    script = """
import sys
from openharness.harness import Harness
h = Harness()
info = h.system_info()
assert info.get('platform') == 'darwin'
res = h.bash('echo "harness_ipc_ok"')
assert res['exit_code'] == 0 and 'harness_ipc_ok' in res['output']
h.close()
print('BUN_HARNESS_PASSED')
"""
    cmd = ["uv", "run", "python", "-c", script] if shutil.which("uv") else [get_venv_python(), "-c", script]
    res = subprocess.run(cmd, cwd=str(ROOT_DIR), capture_output=True, text=True)
    duration = time.time() - t0
    passed = "BUN_HARNESS_PASSED" in res.stdout
    output = (res.stdout + "\n" + res.stderr).strip()
    return passed, output, duration


def run_mac_adapter_test() -> Tuple[bool, str, float]:
    """Verifies native macOS computer-use adapter."""
    t0 = time.time()
    script = """
from openharness.mac_adapter import MacAdapter
adapter = MacAdapter()
print('MAC_ADAPTER_PASSED')
"""
    cmd = ["uv", "run", "python", "-c", script] if shutil.which("uv") else [get_venv_python(), "-c", script]
    res = subprocess.run(cmd, cwd=str(ROOT_DIR), capture_output=True, text=True)
    duration = time.time() - t0
    passed = "MAC_ADAPTER_PASSED" in res.stdout
    output = (res.stdout + "\n" + res.stderr).strip()
    return passed, output, duration


def run_browser_adapter_test() -> Tuple[bool, str, float]:
    """Verifies Browser Harness CDP adapter."""
    t0 = time.time()
    script = """
from openharness.browser_adapter import BrowserAdapter
b = BrowserAdapter()
print('BROWSER_ADAPTER_PASSED')
"""
    cmd = ["uv", "run", "python", "-c", script] if shutil.which("uv") else [get_venv_python(), "-c", script]
    res = subprocess.run(cmd, cwd=str(ROOT_DIR), capture_output=True, text=True)
    duration = time.time() - t0
    passed = "BROWSER_ADAPTER_PASSED" in res.stdout
    output = (res.stdout + "\n" + res.stderr).strip()
    return passed, output, duration


def run_api_server_test() -> Tuple[bool, str, float]:
    """Verifies Node.js API server endpoints and execution."""
    t0 = time.time()
    res = subprocess.run(["node", "server/test.js"], cwd=str(ROOT_DIR), capture_output=True, text=True)
    duration = time.time() - t0
    passed = res.returncode == 0
    output = (res.stdout + "\n" + res.stderr).strip()
    return passed, output, duration


def main():
    parser = argparse.ArgumentParser(description="Comprehensive OpenHarness Test Runner")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose test logs")
    parser.add_argument("--unit", action="store_true", help="Run only pytest unit tests")
    parser.add_argument("--harness", action="store_true", help="Run only Bun harness IPC test")
    parser.add_argument("--server", action="store_true", help="Run only Node.js API server tests")
    args = parser.parse_args()

    print(f"""{Style.BOLD}{Style.CYAN}
==============================================================================
          ⌘ OPENHARNESS - COMPREHENSIVE TEST SUITE (by OpenAgent)
=============================================================================={Style.RESET}""")

    tests = []
    if args.unit:
        tests = [("Pytest Unit Tests", lambda: run_unit_tests(args.verbose))]
    elif args.harness:
        tests = [("Bun Harness Stdio IPC", run_bun_harness_test)]
    elif args.server:
        tests = [("Node.js API Server Endpoints", run_api_server_test)]
    else:
        tests = [
            ("Pytest Unit Tests", lambda: run_unit_tests(args.verbose)),
            ("Bun Harness Stdio IPC", run_bun_harness_test),
            ("macOS Harness Adapter", run_mac_adapter_test),
            ("Browser Harness Adapter", run_browser_adapter_test),
            ("Node.js API Server Endpoints", run_api_server_test),
        ]

    results = []
    all_passed = True
    total_time = 0.0

    for name, test_fn in tests:
        print(f"\n{Style.BOLD}Running: {name}...{Style.RESET}")
        passed, out, duration = test_fn()
        total_time += duration
        results.append((name, passed, duration, out))
        if passed:
            print(f"  {Style.GREEN}✓ PASSED{Style.RESET} ({duration:.2f}s)")
        else:
            all_passed = False
            print(f"  {Style.RED}✗ FAILED{Style.RESET} ({duration:.2f}s)")
            if args.verbose or not args.unit:
                for line in out.splitlines()[-10:]:
                    print(f"    {Style.DIM}{line}{Style.RESET}")

    print(f"\n{Style.BOLD}==============================================================================")
    print("                         TEST REPORT SUMMARY")
    print(f"=============================================================================={Style.RESET}")
    for name, passed, duration, _ in results:
        status = f"{Style.GREEN}PASS{Style.RESET}" if passed else f"{Style.RED}FAIL{Style.RESET}"
        print(f"  [{status}]  {name:35s} ({duration:.2f}s)")
    print(f"==============================================================================")
    print(f"Total Time: {total_time:.2f}s")
    if all_passed:
        print(f"{Style.BOLD}{Style.GREEN}ALL TESTS PASSED SUCCESSFULLY!{Style.RESET}\n")
        sys.exit(0)
    else:
        print(f"{Style.BOLD}{Style.RED}SOME TESTS FAILED!{Style.RESET}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
