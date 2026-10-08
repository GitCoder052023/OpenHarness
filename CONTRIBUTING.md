# Contributing to OpenHarness
### By [OpenAgent](https://github.com/GitCoder052023/OpenAgent)

Thank you for your interest in contributing to **OpenHarness**!

OpenHarness is the open, model-agnostic execution harness for macOS created by the OpenAgent project. We welcome contributions from developers, researchers, and agent builders.

## Development Prerequisites

* **Hardware / OS**: macOS 14 (Sonoma) or macOS 15 (Sequoia) running on Apple Silicon or Intel.
* **Python**: 3.11 or newer.
* **uv**: Astral Python package and project manager ([astral.sh/uv](https://astral.sh/uv)).
* **Node.js**: v18 or newer ([nodejs.org](https://nodejs.org/)).
* **Bun**: Modern JavaScript/TypeScript runtime ([bun.sh](https://bun.sh)).
* **Homebrew Utilities**: `ripgrep` (`brew install ripgrep`).

## Development Setup

### Automated Setup
```bash
git clone https://github.com/GitCoder052023/OpenHarness.git
cd OpenHarness

# Autonomous zero-touch setup:
./install.py

# Verify entire system with test suite:
./test.py
```

### Running the API Server
```bash
npm start
# Or with auto-reload:
npm run dev
```

### Running Tests
```bash
# Full test suite:
./test.py

# Pytest unit tests only:
uv run pytest

# API server tests:
npm test
```

## Adding New Tools

OpenHarness tools can be added across the five engines:
1. **Developer Tools**: Add primitives to `src/tools/cli-harness/harness-bridge.ts` and wrap in `src/OpenHarness/harness.py`.
2. **Native macOS Tools**: Extend `src/tools/macos-harness/src/macos_harness/`.
3. **Browser Tools**: Extend `src/tools/browser-harness/src/browser_harness/`.
4. **Dispatcher**: Register execution in `src/OpenHarness/dispatcher.py`.
5. **API Manifest**: Add schema and description to `server/tools-manifest.js`.
6. **Tests**: Add unit test coverage in `tests/`.

## Code Style & Commits

We follow Conventional Commits:
- `feat: add new tool for ...`
- `fix: resolve issue with ...`
- `docs: update API reference`
- `refactor: clean up ...`

---
OpenHarness is open-source software licensed under the [MIT License](LICENSE).
