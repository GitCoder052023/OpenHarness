"""OpenHarness by OpenAgent.

The open, model-agnostic execution harness for autonomous agents on macOS.
Exposes 55+ developer, native desktop, browser, web scraping, and social automation
tools to any LLM (Claude, Gemini, Codex, local models) or agent framework.
"""

from typing import Any, Dict, List, Optional
from .harness import Harness, HarnessError
from .dispatcher import (
    execute_tool_call,
    execute,
    parse_tool_calls,
    parse_tool_call,
    get_default_harness,
    get_default_mac_adapter,
    get_default_browser_adapter,
    get_default_firecrawl_adapter,
    get_default_loco_adapter,
)
from .config import Config

try:
    from .mac_adapter import MacAdapter
except ImportError:
    MacAdapter = None  # type: ignore[assignment,misc]

try:
    from .browser_adapter import BrowserAdapter
except ImportError:
    BrowserAdapter = None  # type: ignore[assignment,misc]

try:
    from .firecrawl_adapter import FirecrawlAdapter, FirecrawlError
except ImportError:
    FirecrawlAdapter = None  # type: ignore[assignment,misc]
    FirecrawlError = Exception  # type: ignore[assignment,misc]

try:
    from .loco_adapter import LocoAdapter, LocoError
except ImportError:
    LocoAdapter = None  # type: ignore[assignment,misc]
    LocoError = Exception  # type: ignore[assignment,misc]


class OpenHarness:
    """Unified OpenHarness interface for programmatic Python usage.

    Example:
        harness = OpenHarness()
        res = harness.execute({"tool": "bash", "args": {"command": "git status"}})
        print(res)
    """

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config.from_env()
        self.harness = get_default_harness()
        self.mac = get_default_mac_adapter()
        self.browser = get_default_browser_adapter()
        self.firecrawl = get_default_firecrawl_adapter()
        self.loco = get_default_loco_adapter()

    def execute(self, call: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single tool call dictionary."""
        return execute_tool_call(
            harness=self.harness,
            call=call,
            mac_adapter=self.mac,
            browser_adapter=self.browser,
            firecrawl_adapter=self.firecrawl,
            loco_adapter=self.loco,
        )

    def doctor(self) -> Dict[str, Any]:
        """Run health audit across all 5 harness engines."""
        status = {
            "harness": "ok" if self.harness is not None else "unavailable",
            "mac_adapter": "ok" if self.mac is not None else "unavailable",
            "browser_adapter": "ok" if self.browser is not None else "unavailable",
            "firecrawl": "ok" if self.firecrawl is not None else "unavailable",
            "locoagent": "ok" if self.loco is not None else "unavailable",
        }
        return status


__all__ = [
    "OpenHarness",
    "Harness",
    "HarnessError",
    "MacAdapter",
    "BrowserAdapter",
    "FirecrawlAdapter",
    "FirecrawlError",
    "LocoAdapter",
    "LocoError",
    "execute_tool_call",
    "execute",
    "parse_tool_calls",
    "parse_tool_call",
    "Config",
]
