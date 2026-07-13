# AGENTS.md

這是給在 IFOC（Intelligent Factory Operations Copilot，智慧工廠營運助理）上工作的 AI 程式代理（Claude Code、Codex、Cursor 或其他工具）的精簡入口文件。

實際的指引都放在 [`ai/`](ai/README.md) — 請從那裡開始：

* [`ai/context/`](ai/context/README.md) — 背景知識（這個專案是什麼）。
* [`ai/rules/`](ai/README.md#rules-index) — 必須遵守的規範（該如何行事）。
* [`ai/skills/`](ai/skills/README.md) — 本專案定義的可執行任務（該做什麼）。
* [`ai/workflows/`](ai/workflows/README.md) — 週期性任務的流程（該怎麼完成）。

`CLAUDE.md` 是 Claude Code 的工具專屬入口文件，同樣指向 `ai/` — 這兩個檔案在內容上絕不能出現分歧，只能各自帶有真正屬於該工具的專屬註記。
