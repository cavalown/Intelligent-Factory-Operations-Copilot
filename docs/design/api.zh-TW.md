# API 契約

## 1. 目的

本文件定義 MVP 階段 IFOC 後端與其客戶端（Vue 3 儀表板與 Machine Simulator）之間的 REST API 契約。

API 層不擁有領域邏輯。它曝露由 Event、Machine、Alert 與 Insight 模組建立的讀取模型（read model），並接受 simulator 的輸入，發布到 Kafka 做非同步處理。

本文件應與以下文件一起閱讀：

* `docs/design/architecture.md` — 第 11 節（API Layer）與第 12 節（Data Storage）
* `docs/design/event-schema.md` — 事件信封與 payload 綱要

---

## 2. 慣例

### 2.1 基底 URL

```text
http://localhost:3000/api
```

MVP 把後端作為單一 NestJS 程序跑在 Docker Compose 後面。目前不需要 API gateway 或帶版本的路徑前綴。

### 2.2 Content Type

所有請求與回應使用 `application/json`。

### 2.3 時間戳記

所有時間戳記是 ISO 8601 UTC 字串，與 `event-schema.md` 的事件信封慣例一致。

```text
2026-07-02T10:30:00.000Z
```

### 2.4 回應信封

成功回應直接回傳資源。列表端點在適用分頁時，把結果包在 `data` 陣列加一個 `pagination` 物件裡。

```json
{
  "data": [ ... ],
  "pagination": {
    "limit": 20,
    "nextCursor": "evt_01J2Z8...",
    "hasMore": true
  }
}
```

單一資源端點回傳資源物件本身，不加包裝。

### 2.5 錯誤信封

所有錯誤使用一致的形狀：

```json
{
  "error": {
    "code": "MACHINE_NOT_FOUND",
    "message": "Machine M-999 was not found."
  }
}
```

完整錯誤代碼表見第 6 節。

### 2.6 無身分驗證

身分驗證與授權不在 MVP 範圍內（見 `docs/product/mvp.md`）。所有端點在本機 Docker Compose 網路上開放。

---

## 3. 資源總覽

| 資源 | 背後的 collection | 說明 |
| --- | --- | --- |
| Machine | `machines` | 機台目前狀態投影。 |
| Event | `machine_events` | 機台不可變的事件歷史。可按機台查詢（§4.3）或跨所有機台查詢（§4.4）。 |
| Alert | `alerts` | 由 WARNING/CRITICAL 事件衍生的問題。 |
| AI Summary | `ai_summaries` | LLM 產生的營運摘要。 |

---

## 4. 端點

### 4.1 `GET /machines`

回傳每台機台的目前狀態投影。

**回應 `200`**

```json
{
  "data": [
    {
      "machineId": "M-001",
      "name": "CNC Mill 01",
      "status": "WARNING",
      "healthScore": 78,
      "currentTemperature": 95,
      "productionCount": 142,
      "lastEventId": "evt_temp_001",
      "lastUpdatedAt": "2026-07-02T10:30:01.000Z"
    }
  ]
}
```

---

### 4.2 `GET /machines/:id`

回傳單一機台的目前狀態投影。

**回應 `200`** — 形狀同 `GET /machines` 中的單一項目。

**回應 `404`** — `:id` 不存在時為 `MACHINE_NOT_FOUND`。

---

### 4.3 `GET /machines/:id/events`

回傳機台的事件歷史，最新在前，使用游標式分頁。

**查詢參數**

| 參數 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `limit` | number | 否 | 最多回傳筆數。預設 `20`，最大 `100`。 |
| `before` | string | 否 | 回傳嚴格早於此事件 `eventId` 的事件。用於往歷史回翻頁。 |
| `eventType` | string | 否 | 篩選單一事件類型，例如 `TEMPERATURE_REPORTED`。 |

**回應 `200`**

```json
{
  "data": [
    {
      "eventId": "evt_temp_001",
      "eventType": "TEMPERATURE_REPORTED",
      "schemaVersion": 1,
      "source": "MACHINE_SIMULATOR",
      "machineId": "M-001",
      "occurredAt": "2026-07-02T10:30:00.000Z",
      "producedAt": "2026-07-02T10:30:01.000Z",
      "correlationId": "corr_demo_001",
      "payload": {
        "temperature": 95,
        "unit": "C"
      }
    }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": "evt_temp_000",
    "hasMore": true
  }
}
```

`nextCursor` 是下一次請求要作為 `before` 傳入的 `eventId`。沒有更舊的事件時，`nextCursor` 為 `null`、`hasMore` 為 `false`。

**回應 `404`** — `:id` 不存在時為 `MACHINE_NOT_FOUND`。

---

### 4.4 `GET /events`

回傳跨所有機台的事件歷史，最新在前，使用與 `GET /machines/:id/events`（§4.3）相同的游標式分頁。為支援不侷限於單一機台的跨機台視圖（Event Center、Dashboard 的 Recent Events）而新增 — 見 `docs/product/mvp.md` §Event Center。

**查詢參數**

| 參數 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `limit` | number | 否 | 最多回傳筆數。預設 `20`，最大 `100`。 |
| `before` | string | 否 | 回傳嚴格早於此事件 `eventId` 的事件。用於往歷史回翻頁。 |
| `eventType` | string | 否 | 篩選單一事件類型，例如 `TEMPERATURE_REPORTED`。 |
| `machineId` | string | 否 | 篩選單一機台。等同以該 `machineId` 呼叫 `GET /machines/:id/events`。 |

**回應 `200`** — 信封形狀同 §4.3；省略 `machineId` 時 `data` 橫跨多台機台：

```json
{
  "data": [
    {
      "eventId": "evt_temp_001",
      "eventType": "TEMPERATURE_REPORTED",
      "schemaVersion": 1,
      "source": "MACHINE_SIMULATOR",
      "machineId": "M-001",
      "occurredAt": "2026-07-02T10:30:00.000Z",
      "producedAt": "2026-07-02T10:30:01.000Z",
      "correlationId": "corr_demo_001",
      "payload": {
        "temperature": 95,
        "unit": "C"
      }
    }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": "evt_temp_000",
    "hasMore": true
  }
}
```

**回應 `404`** — 提供的 `machineId` 篩選不存在時為 `MACHINE_NOT_FOUND`。省略 `machineId` 時不適用。

---

### 4.5 `GET /machines/:id/alerts`

回傳由此機台事件衍生的告警，最新在前。

**查詢參數**

| 參數 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `status` | string | 否 | 以 `ACTIVE`、`ACKNOWLEDGED`、`RESOLVED` 中一或多個篩選，以逗號分隔（例如 `ACTIVE,ACKNOWLEDGED`）。省略時回傳所有狀態。 |

**回應 `200`**

```json
{
  "data": [
    {
      "alertId": "alert_001",
      "machineId": "M-001",
      "eventId": "evt_temp_001",
      "severity": "WARNING",
      "status": "ACTIVE",
      "message": "Temperature 95C exceeds warning threshold.",
      "createdAt": "2026-07-02T10:30:01.000Z",
      "acknowledgedAt": null,
      "resolvedAt": null
    }
  ]
}
```

**回應 `404`** — `:id` 不存在時為 `MACHINE_NOT_FOUND`。

---

### 4.6 `GET /machines/:id/summary`

回傳機台最近一次產生的 AI 摘要。

**回應 `200`**

```json
{
  "summaryId": "summary_001",
  "machineId": "M-001",
  "scope": "MACHINE",
  "inputEventIds": ["evt_prod_098", "evt_temp_001"],
  "summary": "M-001 was running normally, then reported a temperature above its warning threshold. No critical errors reported.",
  "recommendedActions": [
    "Check cooling system airflow.",
    "Monitor temperature for the next cycle."
  ],
  "model": "gpt-4.1",
  "createdAt": "2026-07-02T10:31:00.000Z"
}
```

**回應 `404`** — 此機台從未產生過摘要時為 `SUMMARY_NOT_FOUND`。`:id` 不存在時為 `MACHINE_NOT_FOUND`。

---

### 4.7 `POST /machines/:id/summary`

為機台觸發新的 AI 摘要。MVP 同步呼叫 LLM 並在回應中回傳產生的摘要 — MVP 沒有工作佇列或輪詢。

**請求主體** — 不需要。

```json
{}
```

**回應 `200`** — 新建立的摘要，形狀同 `GET /machines/:id/summary`。

**回應 `404`** — `:id` 不存在時為 `MACHINE_NOT_FOUND`。

**回應 `502`** — 上游 LLM API 呼叫失敗時為 `LLM_CALL_FAILED`。儀表板應把它當成輔助功能的失敗，繼續顯示既有的機台/事件/告警資料（見 `architecture.md` 第 16 節：「Keep AI failure isolated from dashboard availability」）。

---

### 4.8 `POST /simulator/events`

接受 Machine Simulator 送出的完整機台事件，並以 `machineId` 作為 key 發布到 `machine.events` Kafka topic。simulator 負責組出完整的事件信封，包含 `eventId`、`occurredAt`、`producedAt`、`correlationId` 與 `schemaVersion`，依 `docs/design/event-schema.md`。

此端點執行信封與 payload 驗證（`event-schema.md` 第 9 節），但不直接更新任何投影 — 投影由 Kafka consumer 非同步更新。

**請求主體**

```json
{
  "eventId": "evt_temp_001",
  "eventType": "TEMPERATURE_REPORTED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-001",
  "occurredAt": "2026-07-02T10:30:00.000Z",
  "producedAt": "2026-07-02T10:30:01.000Z",
  "correlationId": "corr_demo_001",
  "payload": {
    "temperature": 95,
    "unit": "C"
  }
}
```

**回應 `202`** — 事件有效並已發布到 Kafka。consumer 非同步處理，所以 `GET /machines/:id`、`.../events` 與 `.../alerts` 可能短暫落後。

```json
{
  "eventId": "evt_temp_001",
  "status": "PUBLISHED"
}
```

若 `eventId` 與先前已接受的事件重複，API 仍回應 `202` — 重複偵測是 consumer 端的冪等性考量（`CLAUDE.md` 設計規則 4），不是 API 層的錯誤。

**回應 `400`** — 必要信封欄位缺失或格式錯誤時為 `INVALID_EVENT_ENVELOPE`。

**回應 `404`** — `machineId` 不符合任何預先 seed 的機台時為 `UNKNOWN_MACHINE`。機台不會由 simulator 事件自動建立 — 見 `docs/design/machine-schema.md` §11。

**回應 `422`** — `eventType` 不屬於 MVP 事件類型時為 `UNSUPPORTED_EVENT_TYPE`；`payload` 不符合該 `eventType` 的綱要時為 `PAYLOAD_VALIDATION_FAILED`。

---

### 4.9 `GET /summary`

回傳最近一次產生的工廠範圍 AI 摘要 — Dashboard 的 AI Summary Card 的資料來源。對應 §4.6，但 `scope: "FACTORY"` 且沒有 `machineId`。由 `add-insights-module` 變更新增（2026-07-10）；`scope` 欄位早已為此預留。

**回應 `200`**

```json
{
  "summaryId": "summary_002",
  "scope": "FACTORY",
  "inputEventIds": ["evt_prod_098", "evt_temp_001"],
  "summary": "Two machines are running normally. M-001 reported a temperature above its warning threshold; no critical errors across the factory.",
  "recommendedActions": [
    "Check M-001's cooling system airflow.",
    "Monitor factory-wide temperature trend for the next cycle."
  ],
  "model": "gpt-4.1",
  "createdAt": "2026-07-02T10:32:00.000Z"
}
```

**回應 `404`** — 從未產生過工廠範圍摘要時為 `SUMMARY_NOT_FOUND`。

---

### 4.10 `POST /summary`

觸發新的工廠範圍 AI 摘要。對應 §4.7：MVP 同步呼叫 LLM 並回傳產生的摘要 — 沒有工作佇列或輪詢。蒐集的脈絡涵蓋所有機台的目前狀態、近期跨機台事件與作用中的告警。

**請求主體** — 不需要。

**回應 `200`** — 新建立的摘要，形狀同 `GET /summary`。

**回應 `502`** — `LLM_CALL_FAILED`，輔助功能隔離方式同 §4.7。

---

### 4.11 `GET /dashboard/stats`

回傳 Dashboard 統計磚（stat tile）渲染用的全工廠聚合，從 `machines` 投影計算。由 `add-frontend-mvp` 變更新增（2026-07-10），讓聚合從第一天就在 API 後面，而不是最終會無聲失去擴展性的客戶端算術。

**回應 `200`**

```json
{
  "machineCount": 3,
  "statusCounts": {
    "RUNNING": 1,
    "IDLE": 0,
    "WARNING": 1,
    "ERROR": 0,
    "MAINTENANCE": 1
  },
  "totalProductionCount": 145,
  "averageHealthScore": 62.7,
  "last24h": {
    "productionCount": 42,
    "operatingMs": 61200000,
    "stoppedMs": 4300000,
    "idleMs": 20900000,
    "approximate": false
  }
}
```

`statusCounts` 永遠包含全部五種狀態，以零填滿。machines collection 為空時，`machineCount` 為 `0`、`averageHealthScore` 為 `null`、`last24h` 全為零。儀表板的「Critical Machines」磚對應 `statusCounts.ERROR`。任一機台的視窗使用了 §4.12 描述的 bootstrap 近似時，`last24h.approximate` 為 `true`。

`last24h`（由 `dashboard-operational-metrics` 變更新增）涵蓋滾動視窗 `[now − 24h, now]`：`productionCount` 依 `occurredAt` 加總 `PRODUCTION_COMPLETED` 的數量；三個時長加總每台機台的分狀態時間桶（見 §4.12）。

---

### 4.12 `GET /machines/:id/utilization`

回傳單一機台滾動 24 小時的分狀態時間，從 `machine_status_transitions` 投影計算：`operatingMs`（`RUNNING` + `WARNING`）、`stoppedMs`（`ERROR` + `MAINTENANCE`）、`idleMs`（`IDLE`）。三個時長加總等於 `windowMs`。

**回應 `200`**

```json
{
  "machineId": "M-001",
  "windowMs": 86400000,
  "operatingMs": 61200000,
  "stoppedMs": 4300000,
  "idleMs": 20900000,
  "approximate": false
}
```

**回應 `404`** — `:id` 不存在時為 `MACHINE_NOT_FOUND`。

**Bootstrap 近似：** 轉移只從該變更部署後開始累積；沒有任何轉移紀錄的機台被視為整個視窗都維持目前狀態，回應帶 `approximate: true`，讓客戶端可以標註該值（儀表板渲染 `≈`）。累積滿 24 小時歷史後（或事件重播重建後）近似即消失。

---

### 4.13 `GET /alerts`

支撐 Dashboard「Active Alerts」小工具的跨機台告警讀取。項目形狀同 §4.4，最新在前。

**查詢參數：** `status`（選填，`ACTIVE` | `ACKNOWLEDGED` | `RESOLVED` 中一或多個，以逗號分隔）、`limit`（選填，預設 20，上限 100）。

**回應 `200`** — `{ "data": [ ...alerts ] }`。

**回應 `400`** — `status` 逗號分隔的任一段不屬於 `ACTIVE` | `ACKNOWLEDGED` | `RESOLVED` 時為 `INVALID_QUERY_PARAMETER`（同樣適用於 §4.5 的 `status` 篩選）。超出範圍的 `limit` 值會被截限（clamp），不會被拒絕。

---

### 4.14 `POST /machines/:id/alerts/:alertId/acknowledge`

把一筆告警標記為操作員已看到。從 `ACTIVE` 出發合法（→ `ACKNOWLEDGED`），從 `ACKNOWLEDGED` 出發是 no-op（已經確認過了）。從 `RESOLVED` 出發會被拒絕 — 告警的生命週期不能往回走（`add-alert-lifecycle` design D1）。

**請求主體** — 不需要。

```json
{}
```

**回應 `200`** — 更新後的告警，形狀同 §4.5 的項目。

```json
{
  "alertId": "alert_001",
  "machineId": "M-001",
  "eventId": "evt_temp_001",
  "severity": "WARNING",
  "status": "ACKNOWLEDGED",
  "message": "Temperature 95C exceeds warning threshold.",
  "createdAt": "2026-07-02T10:30:01.000Z",
  "acknowledgedAt": "2026-07-02T10:35:00.000Z",
  "resolvedAt": null
}
```

**回應 `404`** — `:id` 不存在時為 `MACHINE_NOT_FOUND`；`:alertId` 在該機台下不存在時為 `ALERT_NOT_FOUND`。

**回應 `409`** — 告警目前的 `status` 是 `RESOLVED` 時為 `INVALID_ALERT_TRANSITION`。

---

### 4.15 `POST /machines/:id/alerts/:alertId/resolve`

把一筆告警標記為已修復。從 `ACTIVE` 或 `ACKNOWLEDGED` 出發合法（→ `RESOLVED`；直接從 `ACTIVE` 結案也合法 — 不強制一定要先確認），從 `RESOLVED` 出發是 no-op（已經結案過了）。

**請求主體** — 不需要。

```json
{}
```

**回應 `200`** — 更新後的告警，形狀同 §4.5 的項目。

```json
{
  "alertId": "alert_001",
  "machineId": "M-001",
  "eventId": "evt_temp_001",
  "severity": "WARNING",
  "status": "RESOLVED",
  "message": "Temperature 95C exceeds warning threshold.",
  "createdAt": "2026-07-02T10:30:01.000Z",
  "acknowledgedAt": null,
  "resolvedAt": "2026-07-02T10:40:00.000Z"
}
```

**回應 `404`** — `:id` 不存在時為 `MACHINE_NOT_FOUND`；`:alertId` 在該機台下不存在時為 `ALERT_NOT_FOUND`。

---

## 5. 資料模型

### 5.1 Machine

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `machineId` | string | 機台識別碼。 |
| `name` | string | 人類可讀的機台名稱。 |
| `status` | string | `RUNNING`、`IDLE`、`WARNING`、`ERROR`、`MAINTENANCE` 之一。 |
| `healthScore` | number | 依 `CLAUDE.md` 機台狀態規則更新的衍生分數。 |
| `currentTemperature` | number | 最新回報的溫度（若有）。 |
| `productionCount` | number | 累計完成的生產數量。 |
| `lastEventId` | string | 最近套用到此投影的事件的 `eventId`。 |
| `lastUpdatedAt` | string | 此投影最近更新的時間戳記。 |

### 5.2 Event

完整信封見 `docs/design/event-schema.md` 第 3 節，各類型的 payload 綱要見第 5 節。

### 5.3 Alert

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `alertId` | string | 告警識別碼。 |
| `machineId` | string | 此告警所屬的機台。 |
| `eventId` | string | 觸發此告警的 `eventId`。 |
| `severity` | string | `WARNING` 或 `CRITICAL`。 |
| `status` | string | `ACTIVE`、`ACKNOWLEDGED`，或 `RESOLVED`。 |
| `message` | string | 人類可讀的告警描述。 |
| `createdAt` | string | 告警建立時間。 |
| `acknowledgedAt` | string \| null | 告警被確認的時間（若適用）。 |
| `resolvedAt` | string \| null | 告警解決時間（若適用）。 |

### 5.4 AI Summary

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `summaryId` | string | 摘要識別碼。 |
| `machineId` | string | 此摘要描述的機台。僅當 `scope` 為 `MACHINE` 時存在。 |
| `scope` | string | `MACHINE`（單機摘要，§4.6–4.7）或 `FACTORY`（全廠摘要，§4.9–4.10）。 |
| `inputEventIds` | string[] | 產生此摘要所用的事件，供追溯。 |
| `summary` | string | LLM 產生的營運摘要文字。 |
| `recommendedActions` | string[] | LLM 建議的後續步驟。 |
| `model` | string | 產生此摘要所用的 LLM 模型識別碼。 |
| `createdAt` | string | 摘要產生時間。 |

---

## 6. 錯誤處理

| HTTP 狀態 | 代碼 | 意義 |
| --- | --- | --- |
| `400` | `INVALID_EVENT_ENVELOPE` | 請求主體缺少必要信封欄位、欄位型別錯誤，或時間戳記不是標準 ISO-8601 UTC（`YYYY-MM-DDTHH:mm:ss.sssZ`，依 §2.3）。 |
| `400` | `INVALID_QUERY_PARAMETER` | 查詢參數值超出其記載的值域（例如 `status` 不在 `ACTIVE`/`ACKNOWLEDGED`/`RESOLVED` 內）。 |
| `404` | `MACHINE_NOT_FOUND` | `:id` 路徑參數不符合任何既有機台。 |
| `404` | `UNKNOWN_MACHINE` | `POST /simulator/events` 主體引用了未預先 seed 的 `machineId`。 |
| `404` | `SUMMARY_NOT_FOUND` | 此機台（§4.6）或工廠（§4.9）尚未產生過 AI 摘要。 |
| `404` | `ALERT_NOT_FOUND` | `:alertId` 不符合任何屬於 `:id` 的告警（§4.14、§4.15）。 |
| `409` | `INVALID_ALERT_TRANSITION` | 要求的告警狀態轉換,從它目前的 `status` 出發是不允許的（§4.14）。 |
| `422` | `UNSUPPORTED_EVENT_TYPE` | `eventType` 不是認可的 MVP 事件類型。 |
| `422` | `PAYLOAD_VALIDATION_FAILED` | `payload` 不符合該 `eventType` 所要求的綱要。 |
| `502` | `LLM_CALL_FAILED` | Insight Service 無法連上 LLM API。 |
| `500` | `INTERNAL_ERROR` | 非預期的伺服器端失敗。 |

---

## 7. 版本管理

MVP 不對 API 路徑做版本管理。在儀表板是唯一消費者期間，應避免對回應形狀做破壞性變更；若破壞性變更無可避免，引入帶版本的路徑前綴（例如 `/api/v2`），而不是原地改動 `/api`。

這與事件信封上的 `schemaVersion` 無關 — 後者版本化的是事件 payload，不是 API 回應。

---

## 8. 未來端點

不屬於 MVP，但 `docs/product/product-roadmap.md` 的路線圖已預期：

```text
GET  /events/search                          # Phase 3 — event search
GET  /machines/:id/history                   # Phase 3 — machine history
POST /insights/chat                          # Phase 4 — AI chat
GET  /digital-twin/:id/state                 # Phase 5 — digital twin
```

每個未來端點在實作前都應先在本文件中規格化，遵循第 4 節相同的契約風格。
