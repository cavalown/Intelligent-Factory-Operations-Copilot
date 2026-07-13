# 提案：add-insights-module

## 為什麼

insights 模組是 MVP 最後一個未實作的後端能力：`backend/src/insights/insights.module.ts` 是空殼，但 MVP 的 Dashboard（AI Summary Card）與機台詳情頁（AI Summary）都依賴它。現在完成它可以解鎖前端工作 — 前端便能對著真實端點建置、完全不需要 mock。2026-07-10 的探索也浮現一個契約缺口：Dashboard 的 AI Summary Card 是工廠層級，但 `docs/design/api.md` 只定義了按機台的摘要端點。

## 改什麼

- 實作既有的 API 契約：`GET /machines/:id/summary` 與 `POST /machines/:id/summary`（`docs/design/api.md` §4.6–4.7）。POST 同步呼叫 LLM（MVP 無工作佇列）；上游 LLM 失敗回傳 `502 LLM_CALL_FAILED` 且與儀表板可用性隔離。
- 為 Dashboard 的 AI Summary Card 新增工廠範圍端點 `GET /summary` 與 `POST /summary`。`ai_summaries.scope` 支援 `MACHINE | FACTORY`。
- 兩種範圍共用一條管線 — 蒐集脈絡 → 建立精簡提示詞 → 呼叫 LLM → 持久化到 `ai_summaries`（經 `inputEventIds` 可追溯）→ 回傳 `summary` + `recommendedActions[]`。只有脈絡蒐集器不同（機台：單一機台的近期事件 + 狀態 + 告警；工廠：所有機台的狀態 + 近期跨機台事件 + 告警）。
- LLM provider 不寫死：一個薄的 `LlmClient` 介面，經環境變數（`LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL`）選擇，第一版有一個具體 adapter。
- 模組結構遵循既有的 `alerts` 模組模式（controller / service / schemas，加一個 `llm/` 子目錄）。
- 更新 `docs/design/api.md` 與 `ai/context/api-contract-summary.md`，加入工廠範圍端點。

刻意延後（只記錄，實作時或之後決定）：多少事件餵入提示詞、結構化輸出策略、502 後的前端重試 UX。

## 能力

### 新能力

- `ai-summary`：產生、持久化並提供 LLM 營運摘要 — 按機台與工廠範圍 — 包括脈絡蒐集、供應商無關的 LLM client、對輸入事件的可追溯性，以及失敗隔離。

### 修改的能力

無 — 既有能力（`alert-detection`、`event-history`、`machine-event-ingestion`、`machine-state-projection`、`kafka-consumer-resilience`）作為輸入被讀取，但其需求不變。

## 影響

- **程式碼**：`backend/src/insights/**`（新的 controller、service、脈絡蒐集器、`llm/` client + adapter、`schemas/ai-summary.schema.ts`）；`backend/src/shared/config/env.config.ts`（新的 `LLM_*` 變數）；`backend/src/app.module.ts` 不變（InsightsModule 已 import）— 驗證接線。
- **API**：除已契約化的兩條按機台路由外，兩條新路由（`GET/POST /summary`）；新錯誤代碼 `LLM_CALL_FAILED`（502）與 `SUMMARY_NOT_FOUND`（404）。
- **資料庫**：新的 `ai_summaries` collection（`ai/context/mongodb-collections.md` 已列出）。
- **文件**：`docs/design/api.md`、`ai/context/api-contract-summary.md` 加入工廠範圍端點。
- **依賴**：第一個 adapter 用一個 LLM provider SDK（或純 HTTP client）；新環境變數 `LLM_PROVIDER`、`LLM_API_KEY`、`LLM_MODEL`。
- **順序**：前端 MVP 工作在本變更完成後開始。
