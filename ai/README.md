# ai/

Tool-agnostic AI-agent guidance for IFOC (Intelligent Factory Operations Copilot). Readable by any AI coding agent — Claude Code, Codex, Cursor, or others — not just one specific tool. Root-level entry files (`CLAUDE.md`, `AGENTS.md`) point here rather than duplicating this content.

| Folder | Purpose |
| --- | --- |
| [`context/`](context/README.md) | Background knowledge an agent needs — what the project is. |
| [`rules/`](rules/) | Norms an agent must follow — how to behave. One rule per file. |
| [`skills/`](skills/README.md) | Executable capabilities/tasks defined for this project — what to do. |
| [`workflows/`](workflows/README.md) | Processes for completing recurring tasks — how to accomplish it. |

## Rules Index

| Rule | Covers |
| --- | --- |
| [documentation-sync.md](rules/documentation-sync.md) | Docs are the source of truth; keep code and `docs/` in sync. |
| [module-boundaries.md](rules/module-boundaries.md) | Module structure, persistence ownership, monolith-by-default. |
| [kafka-consumer-conventions.md](rules/kafka-consumer-conventions.md) | Consumer group IDs, idempotency guards. |
| [error-handling.md](rules/error-handling.md) | HTTP status/error codes must match `api.md` §6. |
| [code-style.md](rules/code-style.md) | TypeScript, lint/format baseline, NestJS layering. |
| [commit-messages.md](rules/commit-messages.md) | `<type>: <description>` convention. |
| [testing.md](rules/testing.md) | Interim testing expectations (strategy not yet finalized). |
| [working-with-project-state.md](rules/working-with-project-state.md) | Read before editing; ask instead of assuming. |
| [secrets-and-env-vars.md](rules/secrets-and-env-vars.md) | Never hardcode or commit credentials; use env vars. |
| [openspec-first.md](rules/openspec-first.md) | Non-trivial changes get an OpenSpec proposal before implementation. |
| [communication-language.md](rules/communication-language.md) | Reply to the user in Traditional Chinese; written artifacts stay English. |
