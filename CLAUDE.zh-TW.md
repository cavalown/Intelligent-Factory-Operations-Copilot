# CLAUDE.md

本檔案為 Claude Code（claude.ai/code）在此 repository 工作時提供指引。

專案脈絡、程式撰寫規則、skills 與 workflows 全都放在 [`ai/`](ai/README.md) — 該資料夾是工具無關（tool-agnostic）的來源，與任何其他在此 repo 上工作的 AI 代理（Codex、Cursor 等）共用。請從那裡開始：

* [`ai/context/`](ai/context/README.md) — 這個專案是什麼（架構、事件綱要、機台/告警規則、API 契約、MVP 範圍）。
* [`ai/rules/`](ai/README.md#rules-index) — 該如何行事（模組邊界、Kafka 慣例、錯誤處理、程式風格、commit 訊息、測試、如何在既有專案狀態下工作）。
* [`ai/skills/`](ai/skills/README.md) — 專案專屬的可執行任務。
* [`ai/workflows/`](ai/workflows/README.md) — 週期性任務的端到端流程。

`AGENTS.md` 是其他工具的對等入口文件 — 指向同一個 `ai/` 資料夾。這兩個檔案在內容上絕不能出現分歧。
