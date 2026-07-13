# Bilingual Documentation — English + Traditional Chinese

Every markdown document outside `ai/` and the tool-internal directories (`.claude/`, `.codex/`) must exist in both English and Traditional Chinese (正體中文). The English file is the source of truth; the Chinese file is a full translation named `<same-basename>.zh-TW.md`, placed next to the English file (e.g. `docs/design/architecture.md` ↔ `docs/design/architecture.zh-TW.md`).

Rules:

- **Creating a new doc**: write the English file and its `.zh-TW.md` counterpart in the same change. Never ship one without the other.
- **Editing an existing doc**: apply the equivalent edit to the `.zh-TW.md` counterpart in the same change, the same way [documentation-sync.md](documentation-sync.md) requires docs and code to move together.
- **Translation style**: translate prose; keep code blocks, identifiers, field names, event types, status values, error codes, API paths, and CLI commands in English exactly as in the source. Technical terms may keep the English term in parentheses on first use, e.g. 事件綱要（event schema）.
- **Scope**: `docs/`, `openspec/`, root-level and module-level `README.md` / `CLAUDE.md` / `AGENTS.md`, and any other human-facing markdown. Files under `ai/`, `.claude/`, and `.codex/` stay English-only — they are agent/tool guidance, not human-facing documentation.
- **Conflicts**: if the two languages ever disagree, the English file wins; fix the `.zh-TW.md` file to match.
