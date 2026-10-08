"""Configuration manager for OpenHarness."""
from dataclasses import dataclass
from pathlib import Path
import os


def load_env_file(path=None):
    if path:
        env_file = Path(path)
    else:
        here = Path(__file__).resolve()
        repo = here.parents[2] if len(here.parents) > 2 and here.parents[1].name == "src" else here.parents[1]
        env_file = repo / ".env"
        if not env_file.is_file():
            env_file = here.parents[1] / ".env"
    if env_file.is_file():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("\"'")
                    if key and key not in os.environ:
                        os.environ[key] = val


@dataclass(frozen=True)
class Config:
    # API Server configuration
    api_host: str = "127.0.0.1"
    api_port: int = 8080

    # Developer harness settings
    harness_timeout: float = 60.0

    # Firecrawl web scraping configuration
    firecrawl_api_url: str = "http://localhost:3002"
    firecrawl_api_key: str = ""
    firecrawl_timeout: float = 60.0

    # LocoAgent social media engine configuration
    locoagent_enabled: bool = True
    locoagent_root: str = ""
    locoagent_default_platform: str = "threads"
    locoagent_timeout: float = 120.0

    # Browser Harness configuration
    bh_domain_skills: bool = True
    bh_tab_marker: bool = True

    # General safety and logging
    safe_mode: bool = True
    log_file: str = "~/Library/Logs/OpenHarness/harness.jsonl"

    @classmethod
    def from_env(cls):
        load_env_file()

        api_host = os.getenv("OPENHARNESS_HOST", cls.api_host)
        try:
            api_port = int(os.getenv("OPENHARNESS_PORT", str(cls.api_port)))
        except (ValueError, TypeError):
            api_port = 8080

        try:
            harness_timeout = float(os.getenv("HARNESS_TIMEOUT", str(cls.harness_timeout)))
        except (ValueError, TypeError):
            harness_timeout = 60.0

        safe_mode_env = os.getenv("OPENHARNESS_SAFE_MODE", os.getenv("BRIDGE_SAFE_MODE", "")).strip().lower()
        if safe_mode_env in ("false", "0", "no", "off"):
            safe_mode = False
        else:
            safe_mode = True

        firecrawl_api_url = os.getenv("FIRECRAWL_API_URL", cls.firecrawl_api_url).rstrip("/")
        firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY", cls.firecrawl_api_key)
        try:
            firecrawl_timeout = float(os.getenv("FIRECRAWL_TIMEOUT", str(cls.firecrawl_timeout)))
        except (ValueError, TypeError):
            firecrawl_timeout = 60.0

        loco_enabled_env = os.getenv("LOCOAGENT_ENABLED", "true").strip().lower()
        locoagent_enabled = loco_enabled_env in ("true", "1", "yes", "on")
        locoagent_root = os.getenv("LOCOAGENT_ROOT", "").strip()
        locoagent_default_platform = os.getenv("LOCOAGENT_DEFAULT_PLATFORM", "threads").strip().lower()
        try:
            locoagent_timeout = float(os.getenv("LOCOAGENT_TIMEOUT", str(cls.locoagent_timeout)))
        except (ValueError, TypeError):
            locoagent_timeout = 120.0

        log_file = os.getenv("OPENHARNESS_LOG_FILE", cls.log_file)

        return cls(
            api_host=api_host,
            api_port=api_port,
            harness_timeout=harness_timeout,
            firecrawl_api_url=firecrawl_api_url,
            firecrawl_api_key=firecrawl_api_key,
            firecrawl_timeout=firecrawl_timeout,
            locoagent_enabled=locoagent_enabled,
            locoagent_root=locoagent_root,
            locoagent_default_platform=locoagent_default_platform,
            locoagent_timeout=locoagent_timeout,
            safe_mode=safe_mode,
            log_file=log_file,
        )
