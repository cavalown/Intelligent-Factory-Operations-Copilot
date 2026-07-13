# 設計：add-insights-module

## 脈絡

`backend/src/insights/insights.module.ts` 是 `app.module.ts` 已 import 的空 `@Module({})`。其他每個 MVP 後端能力都已存在（events、machines、alerts、simulator）。按機台摘要端點的行為已在 `docs/design/api.md` §4.6–4.7 與 `docs/design/architecture.md` §7.6 / §10.3 契約化；本變更實作該契約並以工廠範圍延伸它（2026-07-10 探索期間決定 — Dashboard 的 AI Summary Card 是工廠層級但沒有端點）。

來自關鍵設計規則的約束：AI 解釋資料，不取代資料（Insight Service 從 Event/Machine/Alert 資料讀取；它永遠不是真實來源）。依 MVP 範圍：無工作佇列、無 RAG、無 WebSocket — `POST` 同步呼叫 LLM。

規模哲學：今天 3 台機台、300 台機台的願景。介面切在業界等級版本會切的地方（供應商無關的 LLM client、以 scope 參數化的管線），但實作維持 MVP 薄度（無重試佇列、無 fallback 鏈、無快取層）。

## 目標 / 非目標

**目標：**

- 完全依既有 API 契約實作 `GET/POST /machines/:id/summary`。
- 新增 `GET/POST /summary`（工廠範圍），回應形狀相同、`scope: "FACTORY"`、省略 `machineId`。
- 一條共用管線：蒐集脈絡 → 建立精簡提示詞 → 呼叫 LLM → 持久化 → 回傳。
- 帶環境變數選擇 provider 的 `LlmClient` 介面；本變更恰好一個具體 adapter。
- LLM 失敗隔離：失敗的 LLM 呼叫回傳 `502 LLM_CALL_FAILED`，永不影響機台/事件/告警端點。
- 摘要持久化到 `ai_summaries`，帶 `inputEventIds` 可追溯性。

**非目標：**

- 工作佇列/非同步產生、輪詢端點、串流回應。
- 提示詞快取、摘要失效/新鮮度政策（GET 一律回傳最新已存文件，不論多舊）。
- 多個 provider adapter、重試、fallback 鏈。
- Kafka topic `insight.summary.requested/generated`（architecture.md 列為未來形狀；MVP 流程依 §10.3 為同步 REST）。
- 前端工作（本變更之後的獨立變更）。

## 決策

### D1：一條管線、兩個脈絡蒐集器

`InsightsService.generate(scope, machineId?)` 對兩種範圍跑相同步驟；只有脈絡蒐集步驟分支：

```
                     ┌────────────────────────┐
 POST /machines/:id/summary ─▶│                        │
                     │  gatherContext(scope)  │──▶ buildPrompt ──▶ LlmClient ──▶ persist ──▶ respond
 POST /summary ────────▶│                        │
                     └────────────────────────┘
   MACHINE: machine state + its recent events + its alerts
   FACTORY: all machines' state + recent cross-machine events + all active alerts
```

理由：兩個端點只差在哪些事實餵入提示詞。以 scope 參數化的 service 讓 `ai_summaries` 保持一致（`scope` 欄位早已為此預留），且未來新增範圍（例如產線）只需動蒐集器。曾考慮的替代方案：兩個獨立 service — 因會重複 4 個相同步驟而否決。

### D2：經既有領域服務讀取，不直接存取 model

脈絡蒐集器使用 `MachinesService`、`EventsService` 與 `AlertsService`，而不是注入 Mongoose model。這在模組邊界強制執行關鍵設計規則 3（Insight 解釋其他服務擁有的資料）。`EventsModule` 與 `AlertsModule` 目前什麼都沒匯出 — 加上 `exports: [EventsService]` / `exports: [AlertsService]`；`MachinesModule` 已匯出其 service。

曾考慮的替代方案：直接注入 `ai_summaries` 式的讀取模型 — 否決，因為那會重複擁有者服務已實作的查詢邏輯（事件排序、告警篩選）。

### D3：`LlmClient` 作為注入 token + 環境變數選擇的 adapter

```
insights/llm/
├── llm-client.ts          # interface + DI token: generate(prompt): Promise<LlmSummaryResult>
├── llm-client.factory.ts  # env-driven provider selection, fail-fast on unknown
└── mock-llm.client.ts     # first concrete adapter (see note below)
```

**實作註記（2026-07-10）：** 真實 provider 的決定在套用時被使用者延後，所以第一個具體 adapter 是內建的 `mock` provider（預設 `LLM_PROVIDER=mock`）：不需 API key、決定性的占位輸出、整條管線可以端到端運行。真實 provider adapter（Anthropic/OpenAI/……）是後續 — 加一個 adapter 檔案、在 factory 註冊，MVP DoD 項目「AI Summary is generated from recent events」就真正達成。

模組經讀取 `env.llm.provider` 的 factory 提供 `LLM_CLIENT`。未知/未設定的 provider 在啟動時以清楚訊息快速失敗。`LlmSummaryResult` 是 `{ summary: string; recommendedActions: string[]; model: string }` — adapter 負責把 provider 輸出轉成該形狀（結構化輸出/工具使用/JSON 解析是 adapter 細節，延後）。

環境變數新增遵循既有的 `env.config.ts` 模式（純 `process.env`、不用 `@nestjs/config`）：`LLM_PROVIDER`、`LLM_API_KEY`、`LLM_MODEL`。

曾考慮的替代方案：在 `InsightsService` 寫死一個 SDK — 否決；這個介面切點正是 300 台機台版本需要換 provider 的地方，而現在做幾乎不花成本。

### D4：經既有 `ApiError` 做失敗隔離

LLM 呼叫失敗（網路、驗證、格式錯誤的輸出）在 `InsightsService` 被接住並重新拋出為 `ApiError(502, 'LLM_CALL_FAILED', …)`，依 api.md §4.7。沒有新的錯誤機制。`GET` 端點永不呼叫 LLM，所以不會這樣 502 — 它們回傳最新已存摘要或 `404 SUMMARY_NOT_FOUND`。

### D5：工廠範圍文件重用機台範圍形狀

`FACTORY` 摘要文件除了 `scope: "FACTORY"` 且無 `machineId` 外完全相同。`GET /summary` 回傳最近的 `scope: "FACTORY"` 文件。Mongoose schema 讓 `machineId` 為選填，並為兩種「最新摘要」查找建立 `{ scope: 1, machineId: 1, createdAt: -1 }` 索引。

### D6：文件在同一變更中更新

`docs/design/api.md` 為 `GET/POST /summary` 加入 §4.6 式的章節，`ai/context/api-contract-summary.md` 加入兩條路由。理由：api.md 是前端變更將對照建置的權威契約；讓它落後會重新製造本變更正要堵上的那個缺口。

## 風險 / 取捨

- [同步 LLM 呼叫可能很慢（數秒）] → MVP demo 可接受；前端應在觸發按鈕顯示載入狀態。無逾時佇列 — 但 adapter 設硬性的 HTTP timeout，讓卡住的呼叫變成乾淨的 502 而不是懸掛的請求。
- [LLM 輸出可能解析不成 `summary`/`recommendedActions`] → adapter 把無法解析的輸出視為失敗 → `502 LLM_CALL_FAILED`。永不儲存格式錯誤的摘要。
- [工廠範圍的提示詞可能隨機台數量無限成長] → 3 台機台時微不足道。限制蒐集的事件數（確切數字是延後的細節），讓介面行為（「近期脈絡、有界」）已經是 300 台機台的行為。
- [第一個 adapter 的 provider 選擇烙進環境變數預設值] → 只有 adapter 檔案與 factory 註冊是 provider 專屬；記載為可替換。
- [除 `createdAt` 外不存新鮮度中繼資料] → MVP 接受 GET 拿到過期摘要；重新產生是明確的使用者動作（POST）。若/當自動更新落地再重新檢視。

## 未決問題

經明確決定延後（記錄於此；實作期間或之後的討論解決）：

1. ~~每種範圍多少近期事件餵入提示詞。~~ **套用時解決、2026-07-10 code review 後修訂：** 機台範圍取最新 20 筆事件（`SUMMARY_EVENT_LIMIT`，對應 `EventsService` 的 `DEFAULT_LIMIT`）；工廠範圍每台機台取樣 `FACTORY_EVENTS_PER_MACHINE = 5` 筆並以最新在前合併，讓話多的機台無法把安靜但 WARNING 的機台擠出提示詞。作用中告警上限 `SUMMARY_ALERT_LIMIT = 20`（MVP 永不解決告警，所以 ACTIVE 集合只增不減）。
2. adapter 內的結構化輸出策略（原生結構化輸出 vs. 工具使用 vs. 文字中 JSON 解析）— 仍未決；與第一個真實 provider adapter 一起變得相關。
3. 502 後的前端 UX（重試方式、錯誤文案）— 屬於前端變更。
4. ~~先為哪個真實 LLM provider 做 adapter~~ **2026-07-12 解決：經使用者明確決定延到 Phase 3（Phase 1/2 不花付費 API 錢）。** mock provider 是 Phase 1 的出貨設定；真實 adapter（與未決問題 2 的結構化輸出）在進入 Phase 3 時一起落地。
