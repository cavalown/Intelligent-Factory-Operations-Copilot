# IFOC 路線圖

IFOC 的目標是從一套輕量級工廠監控系統，逐步演化為具備事件分析、智慧輔助與 Digital Twin 整合能力的 AI 驅動營運平台。

## IFOC 是什麼？

**IFOC（Intelligent Factory Operations Copilot，智慧工廠營運助理）** 是一套 AI 驅動的平台，用於監控工廠營運、處理工業事件，並以智慧洞察協助操作員。

專案透過五個階段漸進演化，從輕量級工廠儀表板開始，最終成為 AI 驅動的 Digital Twin 平台。

---

# 專案路線圖

| 階段    | 名稱                     | 目標                                        |
| ------- | ------------------------ | ------------------------------------------- |
| Phase 1 | Factory Foundation       | 建立核心工廠監控平台                        |
| Phase 1.1 | Observability Foundation | 讓平台自身的行為可被觀測（traces、結構化日誌、metrics） |
| Phase 1.2 | Responsive Operator UI | 讓儀表板在操作員實際攜帶的裝置（平板、手機）上可用 |
| Phase 2 | Event Streaming          | 建立事件驅動架構                            |
| Phase 3 | Operational Intelligence | 把事件轉化為營運知識                        |
| Phase 4 | AI Copilot               | 提供 AI 輔助的營運支援                      |
| Phase 5 | Digital Twin             | 連接真實工廠環境                            |

---

# Phase 1 — Factory Foundation

## 目標

打造最小可行的智慧工廠平台。

### 功能

* Dashboard
* 機台列表
* 機台詳情
* Event Center
* 事件模擬器
* 機台狀態監控
* 工廠統計
* 健康分數

### 第一週 MVP

* Dashboard
* 機台列表
* 機台詳情
* Event Center
* Simulator
* Kafka 事件流
* AI 摘要 *（Phase 4 的預覽）*

---

# Phase 1.1 — Observability Foundation

## 目標

讓平台自身的執行期行為可被觀測 — 目前各服務只是隨意輸出到 stdout，HTTP 失敗不留痕跡，也沒有任何機制把一個請求與它觸發的 Kafka consumer 關聯起來。於 2026-07-12 新增為獨立子階段，因為這些工作量大到不宜併入 Phase 1，又基礎到不該等到 Phase 2。

### 功能

* 後端 OpenTelemetry 儀器化（自動儀器化的 HTTP / Mongoose / kafkajs traces 與 metrics，供應商中立的 OTLP 輸出）
* 帶 trace 關聯的結構化 JSON 日誌（每一行請求範圍的日誌都含 `trace_id`；consumer 的 span 與日誌帶事件 `correlationId`）
* Grafana 可觀測性堆疊以單一 demo 容器提供（`grafana/otel-lgtm`：Collector + Loki + Tempo + Prometheus + Grafana）— 刻意採 demo 等級；本專案不部署到正式環境，且 OTLP 介面意味著之後可以在不動應用程式碼的情況下，用真正的 LGTM 堆疊替換這個容器
* 優雅降級：可觀測性容器不存在時，平台的運作完全相同

### 範圍註記

* 前端（瀏覽器）遙測不在範圍內 — 後端優先。
* 不使用付費／託管的可觀測性服務（與「Phase 3 之前不花錢」的決策一致）。

---

# Phase 1.2 — Responsive Operator UI

## 目標

讓前端在工廠監控實際發生的裝置上可用 — 現場操作員攜帶的平板、主管/值班人員使用的手機 — 同時不能讓控制室的桌面版面退步。於 2026-07-12 新增；MVP 前端當時有意識地只做桌面版（add-frontend-mvp 的 Non-Goal），這個子階段就是償還那筆債。

### 功能

* 手機上採用底部分頁列導覽（桌面保留頂部水平選單）
* 機台列表在手機上以觸控友善的卡片呈現；查詢型表格（Event Center、詳情頁事件列表）精簡欄位並允許水平捲動
* 並排版面（Dashboard、機台詳情）在平板斷點以下改為堆疊
* 使用 Naive UI 斷點系統（640 / 1024）— 不自訂斷點、不新增依賴
* 透過既有的 Playwright 流程在三種視口驗證

### 範圍註記

* 常設規則 `ai/rules/frontend-responsive.md`（每個前端變更都要在設計階段說明其手機/平板行為）與本子階段一同建立，適用於所有未來的前端工作。
* 桌面版面不得退步 — 控制室仍是一級目標。

---

# Phase 2 — Event Streaming

## 目標

把系統轉型為事件驅動平台。

### 功能

* Kafka 事件串流
* Rule Engine *（同時統一目前在 Machine Service 與 Alert Service 之間重複的事件詮釋邏輯 — 見 `docs/design/machine-schema.md` §5.4）*
* 事故管理（Incident Management）
* 通知中心
* 事件重播（Event Replay）
* 透過 SSE invalidate 的即時更新 *（2026-07-13 決定：儀表板的資料流純粹是 server→client，因此由 Server-Sent Events 推送微小的「已變更」通知來失效前端查詢是正確機制 — 而不是陽春版 WebSocket；只有在真正出現雙向串流需求時才重新考慮 WebSocket，而本路線圖上沒有這種需求）*
* 事件歷史
* 告警確認與解決工作流程
* 告警升級規則（針對未解決的 critical 告警）

---

# Phase 3 — Operational Intelligence

## 目標

把工廠資料轉化為營運知識。

### 功能

* 接上真實 LLM 供應商（2026-07-12 決定：Phase 1/2 以內建 `mock` provider 交付 — 此階段之前不產生付費 API 支出；`LlmClient` 介面與環境變數切換已經就緒，所以進入此階段時只需一個 adapter 檔案，而且下面的 RAG 反正也需要它）
* SOP 知識庫
* RAG
* 事件搜尋
* 根因分析
* 機台歷史
* 維護歷史
* 生產分析，包括：
  * 停機頻率追蹤
  * 平均確認／解決時間（MTTA / MTTR）
  * 重複問題模式分析
  * 瓶頸與高風險設備識別

---

# Phase 4 — AI Copilot

## 目標

以 AI 產生的洞察與建議協助工廠操作員。

### 功能

* AI 對話
* AI 摘要
* AI 建議
* 根因解釋
* 復原建議
* 工單建議
* 預測性維護
* 維護規劃

---

# Phase 5 — Digital Twin

## 目標

讓平台連接真實的工業環境。

### 功能

* OPC UA 整合
* PLC 整合
* 即時感測器資料
* 即時工廠視覺化
* 3D 工廠視圖
* Digital Twin 模擬
* 多產線監控
* 事件轉譯層（Event Translation Layer）— 把各廠商／各公司特有的事件代碼與嚴重度等級映射到 IFOC 標準事件綱要（`docs/design/event-schema.md`），因為真實的 PLC/SCADA/MES 來源不會原生輸出 IFOC 的格式

---

# 未來考量（尚未定義範圍）— 多租戶 SaaS 平台

這是一個占位項，不是已承諾的階段。把 IFOC 從單一工廠的營運助理轉型為賣給多家公司的產品，是策略定位的決策，而非漸進式功能 — 這需要重新檢視 MVP 範圍邊界（`ai/context/mvp-scope-boundaries.md`，其中明確排除身分驗證與多租戶支援），且必須先有專門的討論，才能放進上面的循序路線圖。

粗略輪廓，供未來參考：

* 租戶 → 工廠 → 產線 → 機台的層級結構
* 角色型存取控制（RBAC）
* 每租戶的事件代碼／嚴重度映射（建立在 Phase 5 的事件轉譯層之上）
* 每租戶的告警規則
* 每租戶獨立的文件知識庫（建立在 Phase 3 的 SOP 知識庫／RAG 之上）

---

# 未來願景

```text
Factory
    │
    ▼
Industrial Events
    │
    ▼
Event Streaming
    │
    ▼
Operational Intelligence
    │
    ▼
AI Copilot
    │
    ▼
Digital Twin
```

圖表原始檔：[`docs/assets/mermaid/roadmap-evolution.mmd`](../assets/mermaid/roadmap-evolution.mmd)。
