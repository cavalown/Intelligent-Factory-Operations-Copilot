# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Project context, coding rules, skills, and workflows all live in [`ai/`](ai/README.md) — that folder is the tool-agnostic source, shared with any other AI agent that works on this repo (Codex, Cursor, etc.). Start there:

* [`ai/context/`](ai/context/README.md) — what this project is (architecture, event schema, machine/alert rules, API contract, MVP scope).
* [`ai/rules/`](ai/README.md#rules-index) — how to behave (module boundaries, Kafka conventions, error handling, code style, commit messages, testing, working with existing project state).
* [`ai/skills/`](ai/skills/README.md) — executable project-specific tasks.
* [`ai/workflows/`](ai/workflows/README.md) — end-to-end processes for recurring tasks.

`AGENTS.md` is the equivalent entry point for other tools — it points to the same `ai/` folder. The two files should never diverge on content.
