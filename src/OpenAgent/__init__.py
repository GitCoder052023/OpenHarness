"""Backwards compatibility shim for OpenAgent -> openharness."""
import sys
import openharness
from openharness import *

sys.modules["OpenAgent"] = openharness
sys.modules["OpenAgent.dispatcher"] = sys.modules.get("openharness.dispatcher", None)
sys.modules["OpenAgent.harness"] = sys.modules.get("openharness.harness", None)
sys.modules["OpenAgent.config"] = sys.modules.get("openharness.config", None)
sys.modules["OpenAgent.diagnostics"] = sys.modules.get("openharness.diagnostics", None)
sys.modules["OpenAgent.mac_adapter"] = sys.modules.get("openharness.mac_adapter", None)
sys.modules["OpenAgent.browser_adapter"] = sys.modules.get("openharness.browser_adapter", None)
sys.modules["OpenAgent.firecrawl_adapter"] = sys.modules.get("openharness.firecrawl_adapter", None)
sys.modules["OpenAgent.loco_adapter"] = sys.modules.get("openharness.loco_adapter", None)
