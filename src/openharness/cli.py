"""Command-line interface for OpenHarness by OpenAgent."""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from openharness import OpenHarness, execute_tool_call


def main():
    parser = argparse.ArgumentParser(
        prog="openharness",
        description="OpenHarness by OpenAgent — The open execution harness for autonomous agents on macOS",
    )
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")

    # execute
    exec_parser = subparsers.add_parser("execute", help="Execute a tool call")
    exec_parser.add_argument("call_json", nargs="?", help="JSON string of the tool call, e.g. '{\"tool\": \"bash\", \"args\": {\"command\": \"ls\"}}'")
    exec_parser.add_argument("--tool", "-t", help="Tool name, e.g. bash, mac_see, browser_open")
    exec_parser.add_argument("--args", "-a", help="Arguments as JSON string, e.g. '{\"command\": \"ls\"}'")

    # doctor
    subparsers.add_parser("doctor", help="Run health check across all 5 engines")

    # list
    subparsers.add_parser("list", help="List all available tools")

    # serve
    serve_parser = subparsers.add_parser("serve", help="Start the Node.js REST API server")
    serve_parser.add_argument("--port", "-p", type=int, default=int(os.environ.get("OPENHARNESS_PORT", 8080)), help="Port to listen on (default: 8080)")
    serve_parser.add_argument("--host", default=os.environ.get("OPENHARNESS_HOST", "0.0.0.0"), help="Host to bind to (default: 0.0.0.0)")

    # worker
    subparsers.add_parser("worker", help="Run the persistent JSON-RPC stdio worker")

    args = parser.parse_args()

    if args.command == "execute":
        if args.call_json:
            try:
                call = json.loads(args.call_json)
            except Exception as e:
                print(f"Error parsing JSON call: {e}", file=sys.stderr)
                sys.exit(1)
        elif args.tool:
            tool_args = json.loads(args.args) if args.args else {}
            call = {"tool": args.tool, "args": tool_args}
        else:
            print("Error: provide either JSON call string or --tool", file=sys.stderr)
            sys.exit(1)

        result = execute_tool_call(call)
        print(json.dumps(result, indent=2))

    elif args.command == "doctor":
        harness = OpenHarness()
        status = harness.doctor()
        print("==============================================================================")
        print("          ⌘ OPENHARNESS - PREFLIGHT ENGINE AUDIT")
        print("==============================================================================")
        for engine, st in status.items():
            symbol = "✓" if st == "ok" else "✗"
            print(f"  {symbol} {engine:20s}: {st}")
        print("==============================================================================")

    elif args.command == "list":
        print("To execute a tool via CLI, run: openharness execute '{\"tool\": \"bash\", \"args\": {\"command\": \"ls\"}}'")

    elif args.command == "serve":
        import shutil
        repo_root = Path(__file__).resolve().parents[2]
        server_path = repo_root / "src" / "server" / "index.ts"
        env = os.environ.copy()
        env["OPENHARNESS_PORT"] = str(args.port)
        env["OPENHARNESS_HOST"] = str(args.host)
        print(f"Starting OpenHarness API server on http://{args.host}:{args.port}...")
        pnpm_bin = shutil.which("pnpm")
        cmd = ["pnpm", "run", "server"] if pnpm_bin else ["npx", "tsx", str(server_path)]
        subprocess.run(cmd, cwd=str(repo_root), env=env)

    elif args.command == "worker":
        from openharness.worker import main as worker_main
        worker_main()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
