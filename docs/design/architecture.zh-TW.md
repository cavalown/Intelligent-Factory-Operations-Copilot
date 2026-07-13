# 架構

## 1. 目的

**IFOC（Intelligent Factory Operations Copilot，智慧工廠營運助理）** 是一套智慧工廠營運平台，協助工程師與操作員理解工廠狀況、調查機台事件，並獲得 AI 輔助的營運洞察。

專案從一個聚焦的 MVP 開始：模擬機台事件、透過事件驅動管線處理、持久化營運歷史、視覺化機台狀態，並產生簡潔的 AI 摘要。

本架構的目的是讓系統：

* 簡單到足以作為 MVP 建造出來。
* 有足夠的結構，能演化為正式生產等級的平台。
* 從一開始就是事件驅動。
* 為未來的 AI Copilot、預測性維護與 Digital Twin 能力做好準備。

本文件描述目標架構方向、MVP 架構，以及從模組化單體通往未來分散式服務的路徑。

---

## 2. 架構願景

IFOC 應從輕量級工廠儀表板演化為智慧營運平台。

長期願景是：

```text
Factory Machines
    -> Industrial Events
    -> Event Streaming Platform
    -> Operational Projections
    -> AI-Assisted Insights
    -> Predictive Maintenance
    -> Digital Twin
```

系統不應只圍繞 AI 設計。AI 是重要能力，但它建立在可靠的事件歷史、機台狀態、告警與營運脈絡之上。

因此架構以事件為中心：

* 事件描述發生了什麼。
* 投影描述系統目前知道什麼。
* API 向操作員曝露有用的視圖。
* AI 摘要並解釋營運脈絡。

---

## 3. 架構原則

1. **從簡單開始，但為擴充而設計。**  
   MVP 應該小而可建，但核心邊界應支撐未來成長。

2. **以事件驅動架構為骨幹。**  
   Kafka 不只是佇列。它是事件樞紐，讓系統的多個部分能獨立地對同一個機台事件做出反應。

3. **每個事件只記錄一次。**  
   機台事件應存為不可變的營運歷史。其他模組從該事件建立自己的視圖。

4. **把歷史與目前狀態分開。**  
   Event Service 擁有歷史。Machine Service 以投影形式擁有機台目前狀態。

5. **AI 是一種能力，不是系統的中心。**  
   AI 應基於可信的營運資料進行解釋與協助。它不應取代事件歷史或機台狀態作為真實來源。

6. **微服務之前先用模組化單體。**  
   MVP 應在單一後端內使用清楚的模組邊界，之後再拆分為獨立服務。

7. **讓架構與產品路線圖對齊。**  
   每個路線圖階段都應自然對應到一次架構演進。

8. **避免過度設計 MVP。**  
   系統應先證明核心流程，只有在真正需要時才增加複雜度。

---

## 4. 系統情境

IFOC 位於工廠資料來源與工廠操作員之間。

MVP 中，機台資料來自模擬器。未來階段中，模擬器可被真實的工業整合（PLC、OPC UA、SCADA、MES、IoT 感測器或邊緣閘道器）取代或擴充。

```text
┌─────────────────────┐
│ Factory Data Source │
│ Simulator / PLC /   │
│ OPC UA / Sensors    │
└──────────┬──────────┘
           │ Machine Events
           ▼
┌─────────────────────┐
│ IFOC Platform       │
│ Event Processing    │
│ Machine State       │
│ Alerts              │
│ AI Insights         │
└──────────┬──────────┘
           │ Operational Views
           ▼
┌─────────────────────┐
│ Operators /         │
│ Engineers           │
└─────────────────────┘
```

MVP 專注於在不需要真實工廠連線的情況下證明平台行為。

---

## 5. 高階架構

目標架構是事件驅動的。一個機台事件可以產生多個投影，而不改變原始事件。

```text
                +----------------------+
                |  Machine Simulator   |
                +----------+-----------+
                           |
                           | machine.events
                           ▼
                  +------------------+
                  |      Kafka       |
                  +--------+---------+
                           |
        +------------------+------------------+
        |                  |                  |
        ▼                  ▼                  ▼
+----------------+  +----------------+  +----------------+
| Event Service  |  | Machine Service|  | Alert Service  |
+----------------+  +----------------+  +----------------+
        |                  |                  |
        +---------+--------+---------+--------+
                  |                  |
                  ▼                  ▼
          +-------------------------------+
          |        Insight Service        |
          +---------------+---------------+
                          |
                          ▼
                  +---------------+
                  |   API Layer   |
                  +-------+-------+
                          |
                          ▼
                  +---------------+
                  |   Dashboard   |
                  +---------------+
```

Mermaid 原始檔（供匯出 `.svg`/`.png`/`.drawio`）：[`docs/assets/mermaid/architecture.mmd`](../assets/mermaid/architecture.mmd)。這只是 Phase 1/MVP 快照 — 要拿去用於後續路線圖階段前，先看該檔案開頭的範圍註記。

MVP 中，這些服務以 NestJS 模組化單體內的模組實作。架構仍以服務命名它們，因為每個模組有清楚的職責，之後可以被抽出。

MVP 執行期流程：

```text
Simulator
    -> REST API
    -> Kafka
    -> Event Consumer
    -> MongoDB
    -> Dashboard
    -> AI Summary
```

---

## 6. 技術棧

| 層 | 技術 | 理由 |
| --- | --- | --- |
| 前端 | Vue 3、TypeScript | 以型別化的 UI 邏輯與元件式開發打造現代儀表板。 |
| 後端 | NestJS | 提供模組化的後端結構、依賴注入、REST API 與 Kafka 整合。 |
| 訊息系統 | Kafka | 作為非同步處理與未來服務解耦的事件骨幹。 |
| 資料庫 | MongoDB | 儲存彈性的機台事件、機台投影、告警與 AI 摘要。 |
| AI | LLM API | 從事件脈絡產生營運摘要與建議。 |
| 本機執行環境 | Docker Compose | 在本機執行 frontend、backend、Kafka 與 MongoDB，供 MVP 開發。 |

所選的技術棧支持快速的 MVP 交付，同時保留通往正式生產架構的務實路徑。

---

## 7. 核心元件

### 7.1 Machine Simulator

Machine Simulator 為 demo 與本機開發產生機台事件。

支援的 MVP 事件：

* `STATUS_CHANGED`
* `TEMPERATURE_REPORTED`
* `ERROR_OCCURRED`
* `MAINTENANCE_REQUIRED`
* `PRODUCTION_COMPLETED`

Simulator 不直接更新機台狀態。它建立事件並發布到事件管線。

### 7.2 Kafka

Kafka 是中央事件樞紐。

MVP 初始 topic：

```text
machine.events
```

Kafka 讓系統能在不改變既有事件 producer 的情況下加入新的 consumer。

未來的 topic 可能包括：

```text
machine.status.updated
machine.alerts.created
insight.summary.requested
insight.summary.generated
maintenance.prediction.generated
digital-twin.state.updated
```

MVP 應以證明架構所需的最少 topic 數量開始。

### 7.3 Event Service

Event Service 負責完整的事件歷史。

職責：

* 從 Kafka 消費機台事件。
* 驗證事件 payload。
* 儲存不可變的事件紀錄。
* 提供事件查詢 API。
* 為未來分析保存營運歷史。

Event Service 回答：

```text
What happened?
When did it happen?
Which machine did it happen to?
```

### 7.4 Machine Service

Machine Service 負責機台目前狀態。

職責：

* 維護機台 profile 資料。
* 維護目前狀態。
* 維護健康分數。
* 維護最新溫度與生產數量。
* 從進來的事件建立機台投影。

Machine Service 回答：

```text
What is the current state of this machine?
```

### 7.5 Alert Service

Alert Service 負責營運問題。

職責：

* 評估警告與嚴重事件。
* 建立告警紀錄。
* 追蹤告警狀態。
* 為儀表板與調查提供告警歷史。

Alert Service 回答：

```text
What needs attention?
```

MVP 中，告警邏輯可以簡單且以程式碼為基礎。可設定的 rule engine 屬於後續階段。

### 7.6 Insight Service

Insight Service 負責 AI 輔助分析。

職責：

* 蒐集事件脈絡。
* 蒐集機台狀態與告警脈絡。
* 為 LLM 建立精簡的提示詞。
* 產生 AI 摘要與建議行動。
* 儲存 AI 摘要歷史。

Insight Service 回答：

```text
What does the recent operational context mean?
What should the operator consider next?
```

Insight Service 不擁有機台的真實。它解釋 Event、Machine 與 Alert 服務產生的資料。

### 7.7 API Layer

API 層向儀表板曝露後端資料。

職責：

* 為前端視圖提供 REST API。
* 從領域模組聚合資料。
* 讓前端特定的回應形狀與領域儲存模型分離。
* 觸發 AI 摘要請求。

### 7.8 Dashboard

Dashboard 是面向操作員的 UI。

MVP 頁面：

* 工廠總覽
* 機台列表
* 機台詳情
* Event center
* Simulator 控制
* AI 摘要面板

儀表板應讓目前的工廠狀態一目瞭然。

---

## 8. 領域職責

核心領域依職責分離。

| 領域 | 職責 | 主要資料 |
| --- | --- | --- |
| Event | 完整的營運歷史 | `machine_events` |
| Machine | 機台目前狀態 | `machines` |
| Alert | 需要注意的問題 | `alerts` |
| Insight | AI 產生的分析 | `ai_summaries` |

同一個事件可被多個領域使用：

```text
Event:
Machine A temperature reached 95 C.

Produces:
Event History            -> complete record of the event
Machine Current State    -> current temperature is 95 C, status is WARNING
Alert                    -> high temperature warning
Insight                  -> suggest checking cooling system and workload
```

這讓職責保持清楚：

* Event Service 保存歷史。
* Machine Service 維護目前狀態。
* Alert Service 識別問題。
* Insight Service 執行分析。

---

## 9. 事件驅動架構

機台事件是系統的基礎。

關鍵規則是：

```text
One event is recorded once.
Different services build their own projections from that event.
```

投影流程：

```text
Machine Event
        |
        ▼
 Event Service
        |
        ├────────► Machine Projection
        |
        ├────────► Alert Projection
        |
        └────────► Insight Projection
```

### 9.1 事件歷史

事件歷史是以附加（append）為導向的。事件不應被當成暫時性訊息。

事件記錄一個事實：

```text
Machine M-001 reported a TEMPERATURE_REPORTED event (95C) at 2026-07-02T10:30:00Z.
```

一旦儲存，事件就成為營運時間軸的一部分。

### 9.2 機台投影

機台投影把事件歷史轉換為目前狀態。

範例：

| 事件 | 機台投影 |
| --- | --- |
| `TEMPERATURE_REPORTED`（超過閾值） | 狀態變為 `WARNING`，健康分數下降 |
| `ERROR_OCCURRED` | 狀態變為 `ERROR`，健康分數大幅下降 |
| `PRODUCTION_COMPLETED` | 狀態變為 `RUNNING`，生產數量增加 |

儀表板讀取此投影來顯示機台目前狀態。

### 9.3 告警投影

告警投影把相關事件轉換為營運告警。Alert Service 從事件類型與 payload 推導 severity — 事件本身沒有原始的 `severity` 欄位（見 §12.1）。

| 事件類型 | 條件 | 建立告警 | Severity |
| --- | --- | --- | --- |
| `TEMPERATURE_REPORTED` | `payload.temperature > machine.temperatureThreshold` | 是 | `WARNING` |
| `TEMPERATURE_REPORTED` | 閾值內 | 否 | — |
| `ERROR_OCCURRED` | — | 是 | `CRITICAL` |
| `MAINTENANCE_REQUIRED` | — | 是 | `WARNING` |
| `STATUS_CHANGED` | `payload.reason` 表示感測器故障 | 是 | `WARNING` |
| `STATUS_CHANGED` | 其他任何轉移 | 否 | — |
| `PRODUCTION_COMPLETED` | — | 否 | — |

這與 `docs/design/machine-schema.md` §5.2 對同樣事件的健康分數處理相呼應：`ERROR_OCCURRED` 一律 `CRITICAL`，不看 `payload.recoverable`（machine-schema.md 同樣不在該欄位上做區分），而 `STATUS_CHANGED` 只在感測器故障情況建立告警 — 也正是它唯一影響健康分數的情況。

未來版本可以用 rule engine 取代簡單的程式碼式邏輯。

### 9.4 洞察投影

洞察投影為 AI 分析準備近期營運脈絡。

它可以使用：

* 近期事件歷史
* 機台目前狀態
* 作用中的告警
* 歷史告警模式
* 未來的 SOP 或維護知識

MVP 中，此投影只用於直接 LLM 摘要。RAG 刻意排除在外。

### 9.5 未來的 Consumer 擴充

由於 Kafka 是事件骨幹，未來的能力可以作為新 consumer 加入：

```text
machine.events
    ├── Machine State Consumer
    ├── Alert Consumer
    ├── AI Insight Consumer
    ├── Predictive Maintenance Consumer
    └── Digital Twin Consumer
```

這讓未來功能的加入不需要改寫既有的事件處理邏輯。

---

## 10. 資料流

### 10.1 模擬事件流程

```text
Operator clicks simulator action
    ↓
Frontend sends REST request
    ↓
Backend simulator creates machine event
    ↓
Backend publishes event to Kafka topic: machine.events
    ↓
Event consumer receives event
    ↓
Event Service stores event history
    ↓
Machine Service updates current state projection
    ↓
Alert Service creates alert when required
    ↓
Dashboard fetches updated views through API
```

### 10.2 儀表板查詢流程

```text
Dashboard
    ↓
API Layer
    ↓
Read models / projections
    ↓
Machines + Events + Alerts + AI Summaries
    ↓
Dashboard renders operational view
```

### 10.3 AI 摘要流程

```text
Operator opens dashboard or machine detail
    ↓
Dashboard requests AI summary
    ↓
API Layer calls Insight Service
    ↓
Insight Service gathers recent events, machine state, and alerts
    ↓
Insight Service calls LLM API
    ↓
AI summary is stored
    ↓
Dashboard displays summary and suggested actions
```

### 10.4 事件重播流程

事件重播不是 MVP 的必要功能，但架構應為它做準備。

```text
Stored Event History
    ↓
Replay events in timestamp order
    ↓
Rebuild Machine Projection
    ↓
Rebuild Alert Projection
    ↓
Validate historical state transitions
```

這對除錯、分析、Digital Twin 模擬與投影復原會變得重要。

---

## 11. API 層

API 層負責面向前端的使用案例。

初始的 REST API：

```text
GET  /machines
GET  /machines/:id
GET  /machines/:id/events
GET  /machines/:id/alerts
GET  /machines/:id/summary
POST /machines/:id/summary
POST /simulator/events
```

API 職責：

* 回傳儀表板可直接使用的資料。
* 隱藏內部持久化細節。
* 觸發 simulator 動作。
* 觸發 AI 摘要。
* 為前端提供穩定的契約。

API 層不應直接包含領域規則。領域規則屬於 Event、Machine、Alert 與 Insight 模組。

詳細的 API 契約放在：

```text
docs/design/api.md
```

---

## 12. 資料儲存

MVP 使用 MongoDB 儲存營運紀錄與投影。

初始 collection：

```text
machines
machine_events
alerts
ai_summaries
```

### 12.1 `machine_events`

儲存不可變的事件歷史。

核心欄位 — 正是 `docs/design/event-schema.md` §3 定義的事件信封欄位，加上一個儲存層欄位：

```text
eventId
eventType
schemaVersion
source
machineId
occurredAt
producedAt
correlationId
payload
createdAt
```

沒有 `severity` 欄位 — 依 `CLAUDE.md` 設計規則 2，severity 是 Alert Service 計算的 consumer 詮釋，不是原始儲存事件的一部分。`createdAt` 是 Event Service 插入文件的時間，與 `occurredAt`（事實發生時間）和 `producedAt`（producer 發布時間）不同 — 它只為儲存／除錯目的存在，不是信封契約的一部分。

建議的索引：

```text
eventId unique
machineId + occurredAt
eventType + occurredAt
```

### 12.2 `machines`

儲存機台 profile 與目前狀態投影。

核心欄位：

```text
machineId
name
status
healthScore
currentTemperature
productionCount
lastEventId
lastUpdatedAt
```

### 12.3 `alerts`

儲存由警告與嚴重事件衍生的告警紀錄。

核心欄位：

```text
alertId
machineId
eventId
severity
status
message
createdAt
resolvedAt
```

### 12.4 `ai_summaries`

儲存產生的 AI 分析。

核心欄位：

```text
summaryId
machineId
scope
inputEventIds
summary
recommendedActions
model
createdAt
```

AI 摘要應可追溯到產生它們所用的事件。

---

## 13. 部署架構

### 13.1 MVP 部署

MVP 使用 Docker Compose。

預期的服務：

```text
frontend
backend
mongodb
kafka (KRaft mode — no separate Zookeeper service)
```

完整的 Compose 檔見 `docs/deployment/docker-compose.md`，為什麼選 Kafka 見 `docs/decisions/ADR-0001-use-kafka.md`。

MVP 部署目標：

* 本機容易啟動。
* 可重複的 demo 環境。
* 不需要 Kubernetes。
* 不依賴真實工廠網路。

### 13.2 正式環境方向

未來的正式環境部署可以朝以下方向演進：

```text
Load Balancer
    ↓
Frontend Static Hosting / CDN
    ↓
Backend API
    ↓
Kafka Cluster
    ↓
Domain Services
    ↓
MongoDB / Operational Database
```

正式環境架構應加入：

* 託管 Kafka 或正式生產 Kafka 叢集。
* 託管資料庫或副本化的 MongoDB。
* 機密管理。
* 可觀測性。
* 身分驗證與授權。
* 網路隔離。
* 備份與復原。

---

## 14. 擴展性策略

MVP 從模組化單體開始。

這是刻意的。第一個目標是證明產品工作流程，而不是太早去運維一個分散式系統。

### 14.1 MVP 結構

```text
backend/
├── machines/
├── events/
├── alerts/
├── insights/
├── dashboard/    # API-layer composition only (§7.7) — owns no persistence
├── simulator/
└── shared/
```

每個模組應擁有自己的領域邏輯與持久化存取。`dashboard/` 是印證規則的例外：它是 §7.7 的 API 層聚合接縫，組合其他模組匯出的服務的讀取（由 `dashboard-operational-metrics` 變更在 `/dashboard/stats` 開始橫跨 machines 與 events 領域時加入）；它不擁有任何 model 或 collection。

### 14.2 服務抽取路徑

系統成長時，模組可以抽取為服務：

```text
event-service
machine-service
alert-service
insight-service
simulation-service
dashboard-api
```

建議的抽取順序：

1. 事件量成長時抽取 Event Service。
2. AI 呼叫變慢、變貴或需要非同步時抽取 Insight Service。
3. 告警規則變得可設定且複雜時抽取 Alert Service。
4. 機台狀態被更多系統共用時抽取 Machine Service。
5. 儀表板查詢變得昂貴時加入專用的讀取模型。

關鍵是服務抽取應跟隨真實壓力，而不是只為了架構好看。

**這是參考選項，不是承諾。** IFOC 目前是一個沒有正式流量、沒有多團隊的 side project，所以上面的壓力條件很可能永遠不會真正發生 — 這是務實的預期，不是因為「只是 side project」而抄捷徑。同樣的壓力驅動規則普遍適用：很多真實的正式生產系統也因為從未達到這些門檻而永遠維持單體。拆分的正當性來自實際壓力，與專案是 side project 還是公司產品無關。未來的模組 — 包括 `docs/product/product-roadmap.md` 討論的 Phase 5 事件轉譯層 — 除非清單上的具體壓力真的出現，否則預設都應住在同一個模組化單體裡。

---

## 15. 一致性與可靠性

MVP 使用最終一致性。

當 simulator 事件被提交時：

1. 後端接受請求。
2. 事件發布到 Kafka。
3. Consumer 非同步處理事件。
4. MongoDB 投影被更新。
5. 儀表板讀取最新可用的狀態。

在處理完成前，儀表板可能短暫顯示先前的狀態。

可靠性考量：

* 用 `eventId` 做冪等性。
* 避免重複的事件紀錄。
* 記錄無效的已消費事件。
* 讓 AI 失敗與儀表板可用性隔離。
* 對暫時性基礎設施失敗優先採用可重試的處理。

MVP 中，簡單的日誌與冪等性就足夠。死信佇列與進階重試政策可以之後再加。

---

## 16. 資安考量

MVP 假設：

* 本機開發環境。
* 模擬的工廠資料。
* 沒有個人資料。
* 沒有身分驗證。

未來的資安工作：

* 身分驗證與授權。
* 角色型存取控制（RBAC）。
* API 速率限制。
* 稽核日誌。
* 機密管理。
* 加密的環境變數。
* Kafka 與 MongoDB 的網路限制。
* 分離的 development、staging、production 環境。

AI 特有的考量：

* 不要把不必要的資料送給 LLM。
* 讓提示詞可追溯到來源事件。
* 把 AI 輸出視為建議性質。
* 把 AI 摘要與作為真實來源的事件紀錄分開儲存。

---

## 17. 未來演進

架構與產品路線圖對齊。

### Phase 1：Factory Foundation

目標：

* 建立核心工廠監控平台。

架構重點：

* Dashboard。
* 機台列表與詳情。
* Event center。
* Simulator。
* 基本的機台狀態投影。
* 基本的 AI 摘要。

### Phase 2：Event Streaming

目標：

* 強化事件驅動架構。

架構重點：

* 更豐富的 Kafka topic。
* 事件重播。
* WebSocket 即時更新。
* Rule engine。
* 事故與通知工作流程。

### Phase 3：Operational Intelligence

目標：

* 把事件轉化為營運知識。

架構重點：

* 事件搜尋。
* 機台歷史。
* 維護歷史。
* SOP 知識庫。
* RAG。
* 根因分析。

### Phase 4：AI Copilot

目標：

* 以 AI 產生的洞察與建議協助操作員。

架構重點：

* AI 對話。
* AI 建議。
* 復原建議。
* 工單建議。
* 多步驟 AI agent 工作流程。
* 使用工具的調查 agent。

### Phase 5：Digital Twin

目標：

* 讓平台連接真實工廠環境與模擬。

架構重點：

* OPC UA 整合。
* PLC 整合。
* 即時感測器資料。
* Digital Twin 狀態模型。
* 歷史事件重播。
* What-if 模擬。
* 3D 工廠視覺化。

此階段引入的真實 producer（PLC、OPC UA、IoT Gateway）必須遵循 `docs/design/event-schema.md` 第 6.3 節的事件觸發時機規則 — 離散事實維持事件觸發，連續感測器讀值使用例外回報而非固定間隔發布。

---

## 18. 架構決策（ADR 摘要）

| 決策 | 選擇 | 理由 |
| --- | --- | --- |
| 後端架構 | 先模組化單體 | 更快交付 MVP，同時保留乾淨的模組邊界。 |
| 事件骨幹 | Kafka | 支援非同步處理、事件重播方向與未來服務解耦。 |
| 資料庫 | MongoDB | 為早期工廠資料提供彈性的事件與投影儲存。 |
| API 風格 | 先 REST | 前端整合簡單，MVP 契約清楚。 |
| AI 策略 | 摘要先於 RAG | 在加入知識檢索前，就能用事件摘要展示 AI 價值。 |
| 部署 | 先 Docker Compose | 最適合本機 MVP demo 與開發速度。 |
| 服務拆分 | 之後、壓力驅動 | 避免過早微服務化，同時保持清楚的抽取路徑。 |

詳細的 ADR 檔案應放在：

```text
docs/decisions/
```

---

## 19. MVP 架構摘要

MVP 架構刻意做得小，但不是用完即丟。

它證明 IFOC 能夠：

1. 產生機台事件。
2. 透過 Kafka 發布事件。
3. 儲存完整的事件歷史。
4. 建立機台狀態與告警投影。
5. 在儀表板顯示營運狀態。
6. 從可信的事件脈絡產生 AI 摘要。

最重要的架構理念是：

```text
Events are the source of operational history.
Projections create useful views.
AI explains the data, but does not replace it.
```
