# 任務：add-insights-module

## 1. 基礎

- [x] 1.1 依既有的純 `process.env` 模式，在 `backend/src/shared/config/env.config.ts` 加入 `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL`
- [x] 1.2 建立 `ai-summary.schema.ts`（`ai_summaries` collection）：`summaryId`、選填的 `machineId`、`scope: MACHINE | FACTORY`（依 Mongoose 聯集型別陷阱使用明確的 `type: String`）、`inputEventIds`、`summary`、`recommendedActions`、`model`、`createdAt`；索引 `{ scope: 1, machineId: 1, createdAt: -1 }`
- [x] 1.3 從 `EventsModule` 匯出 `EventsService`、從 `AlertsModule` 匯出 `AlertsService`，讓 insights 脈絡蒐集器可以使用它們（設計 D2）；為工廠範圍新增 `AlertsService.listAlerts()` 跨機台讀取

## 2. LLM Client

- [x] 2.1 在 `insights/llm/llm-client.ts` 定義 `LlmClient` 介面 + DI token（`generateSummary(prompt) → { summary, recommendedActions, model }`）
- [x] 2.2 實作第一個具體 adapter — **內建的 `mock` provider**（真實 provider 的選擇被使用者延後，見設計 D3 實作註記）；不需 API key、決定性輸出
- [x] 2.2b 後續：實作真實 provider adapter — **以延後解決（2026-07-12）：使用者決定 Phase 3 之前不用付費 LLM API**；mock provider 作為 Phase 1 的 AI 摘要出貨（適合 demo 的一次性觸發），真實 adapter 在進入 Phase 3 時落地（RAG 反正需要真實 LLM）。`LlmClient` 介面 + 環境變數切換已讓那只是加一個檔案。見 design.md 未決問題 4 與 docs/product/product-roadmap.md Phase 3。
- [x] 2.3 在 `InsightsModule` 經環境變數驅動的 factory 提供 `LLM_CLIENT`；未知 `LLM_PROVIDER` 時在啟動快速失敗，指名無效的值與支援的 provider

## 3. Insights 管線

- [x] 3.1 在 `InsightsService` 經 `MachinesService` / `EventsService` / `AlertsService` 為兩種範圍實作脈絡蒐集（MACHINE：單一機台狀態 + 近期事件 + 告警；FACTORY：所有機台 + 近期跨機台事件 + 告警），並記下 `inputEventIds`
- [x] 3.2 從蒐集的脈絡實作精簡提示詞建構（上限：`SUMMARY_EVENT_LIMIT = 20`，解決設計未決問題 1）
- [x] 3.3 實作 `generateSummary(scope, machineId?)`：蒐集 → 提示詞 → LLM → 持久化 → 回傳；把 LLM 失敗包成 `ApiError(502, 'LLM_CALL_FAILED', …)` 且失敗時不持久化任何東西
- [x] 3.4 為兩種範圍實作最新摘要讀取（不呼叫 LLM；不存在時 `SUMMARY_NOT_FOUND`）

## 4. API 端點

- [x] 4.1 依 `docs/design/api.md` §4.6–4.7 實作 `GET/POST /machines/:id/summary`，含未知機台的 `MACHINE_NOT_FOUND`（在任何 LLM 呼叫前驗證）
- [x] 4.2 實作 `GET/POST /summary`（工廠範圍），回應形狀相同、`scope: "FACTORY"`、無 `machineId`
- [x] 4.3 遵循 `alerts` 模組模式把 controller/service/schema/llm provider 接進 `InsightsModule`

## 5. 測試

- [x] 5.1 單元測試 `InsightsService`：各範圍的成功路徑、LLM 失敗 → 502 + 不持久化、既有摘要在重新產生失敗後仍在、`inputEventIds` 與提示詞脈絡一致
- [x] 5.2 單元測試 controller/端點行為：404 `MACHINE_NOT_FOUND`、404 `SUMMARY_NOT_FOUND`、GET 永不呼叫 LLM
- [x] 5.3 單元測試 LLM client factory：provider 選擇與未知 provider 的快速失敗

## 6. 文件

- [x] 6.1 在 `docs/design/api.md` 加入 `GET/POST /summary` 章節（§4.9–4.10；§5.4 與 §6 為 FACTORY 範圍更新）
- [x] 6.2 以兩條工廠範圍路由更新 `ai/context/api-contract-summary.md` 的端點清單
- [x] 6.3 在 `docs/deployment/docker-compose.md` §5 記載新的 `LLM_*` 環境變數，並在 `docker-compose.yml` 傳遞它們

## 7. 驗證

- [x] 7.1 對 Docker Compose 跑完整 demo 路徑：模擬事件 → POST 機台摘要 → GET 它 → POST 工廠摘要 → GET 它（`mock` provider、不需 API key）；以未知 `LLM_PROVIDER` 啟動一次驗證快速失敗（502 路徑在真實 adapter 存在前由單元測試涵蓋）— 2026-07-10 驗證：第一個摘要前 404、兩種範圍都 200、工廠回應不帶 `machineId`、M-999 為 `MACHINE_NOT_FOUND`、`LLM_PROVIDER=bogus` 時啟動中止
