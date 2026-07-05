# AGENTS.md

This is a thin entry point for AI coding agents (Claude Code, Codex, Cursor, or others) working on IFOC (Intelligent Factory Operations Copilot).

The actual guidance lives in [`ai/`](ai/README.md) — start there:

* [`ai/context/`](ai/context/README.md) — background knowledge (what the project is).
* [`ai/rules/`](ai/README.md#rules-index) — norms to follow (how to behave).
* [`ai/skills/`](ai/skills/README.md) — executable project-specific tasks (what to do).
* [`ai/workflows/`](ai/workflows/README.md) — processes for recurring tasks (how to accomplish it).

`CLAUDE.md` is Claude Code's tool-specific entry point and also points to `ai/` — the two files should never diverge on content, only on any genuinely tool-specific notes either one carries.
