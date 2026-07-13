# 事件流程 — 完整範例

## 1. 目的

`docs/design/architecture.md` §9–10 已經解釋了事件驅動架構與它的四種流程類型（模擬事件流程、儀表板查詢流程、AI 摘要流程、事件重播流程）。本文件不重複那些結構性說明。

本文件改為跟隨**一個具體事件**走完它的整個生命週期 — 就是 `docs/design/event-schema.md`、`docs/design/api.md` 與 `docs/design/machine-schema.md` 已經使用的同一個 `M-001` / `evt_temp_001` 範例 — 展示每個模組在每一步實際產出的文件。想看整個系統對單一事件端到端的反應時用本文件；想理解流程的一般形狀時用 `architecture.md` §9–10。

時序圖原始檔：[`docs/assets/mermaid/event-flow.mmd`](../assets/mermaid/event-flow.mmd)（只涵蓋 §3 — 見該檔案的範圍註記）。

---

## 2. 情境設定

機台 `M-001` 存在，且在該事件抵達*之前*處於以下狀態：

```json
{
  "machineId": "M-001",
  "name": "CNC Mill 01",
  "temperatureThreshold": 80,
  "status": "RUNNING",
  "healthScore": 88,
  "currentTemperature": 65,
  "productionCount": 142,
  "lastEventId": "evt_prod_098",
  "lastUpdatedAt": "2026-07-02T09:15:00.000Z"
}
```

操作員正在看儀表板的 Simulator 頁面，為 `M-001` 觸發一個讀值 `95°C` 的 `TEMPERATURE_REPORTED` 事件 — 與 `event-schema.md` §11.1、`api.md` §4.7、`machine-schema.md` §9 貫穿使用的是同一個事件。

---

## 3. 逐步走訪

### 3.1 Simulator 觸發

儀表板的 simulator 控制項組出完整的事件信封（依「Simulator 送出完整信封」的決策 — `api.md` §4.7），呼叫：

```text
POST /simulator/events
```

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

### 3.2 API 驗證與 Kafka 發布

後端依 `event-schema.md` §9 驗證信封與 payload，然後以 `machineId: "M-001"` 作為 key 發布到 `machine.events` topic。它立即回應，早於任何投影更新：

```text
202 Accepted
{ "eventId": "evt_temp_001", "status": "PUBLISHED" }
```

### 3.3 Consumer 平行處理

三個 consumer 獨立接收同一則 Kafka 訊息，更新三個不同的 collection。彼此互不等待。

**Event Service** → `machine_events`（把 §3.1 的信封原封不動地存為不可變歷史）。

**Machine Service** → 套用 `machine-schema.md` §7 的投影演算法：

```text
95 > temperatureThreshold (80)  →  status raised RUNNING(1) → WARNING(2)
                                →  healthScore: 88 - 10 = 78
                                →  currentTemperature: 95
                                →  lastEventId: evt_temp_001
                                →  lastUpdatedAt: 2026-07-02T10:30:01.000Z
```

產生的 `machines` 文件（與 `api.md` §5.1、`machine-schema.md` §9 已展示的範例相同）：

```json
{
  "machineId": "M-001",
  "name": "CNC Mill 01",
  "temperatureThreshold": 80,
  "status": "WARNING",
  "healthScore": 78,
  "currentTemperature": 95,
  "productionCount": 142,
  "lastEventId": "evt_temp_001",
  "lastUpdatedAt": "2026-07-02T10:30:01.000Z"
}
```

**Alert Service** → 溫度超過閾值，因此建立一筆告警（對應 `api.md` §4.4 的範例）：

```json
{
  "alertId": "alert_001",
  "machineId": "M-001",
  "eventId": "evt_temp_001",
  "severity": "WARNING",
  "status": "ACTIVE",
  "message": "Temperature 95C exceeds warning threshold.",
  "createdAt": "2026-07-02T10:30:01.000Z",
  "resolvedAt": null
}
```

### 3.4 儀表板讀取更新後的狀態

儀表板在此事件觸發前就已經在輪詢 `GET /machines/M-001`。由於處理是非同步的（§3.2 在 §3.3 執行前就回應了），存在一個真實的時間窗 — 實務上是毫秒級，但沒有保證 — 儀表板的請求仍可能回傳 §2 的*事件前*狀態。這就是 `architecture.md` §15 記載的最終一致性行為；本走訪展示的是那個章節搭配真實文件的樣子。

Consumer 完成後，`GET /machines/M-001` 回傳 §3.3 的 `machines` 文件，`GET /machines/M-001/alerts` 包含 `alert_001`。

### 3.5 AI 摘要產生

操作員打開 `M-001` 的詳情頁並請求摘要：

```text
POST /machines/M-001/summary
```

Insight Service 蒐集近期脈絡 — 包括先前的事件 `evt_prod_098` 與新的 `evt_temp_001` — 呼叫 LLM，並儲存結果（對應 `api.md` §4.5 的範例，已修正為引用真正屬於 `M-001` 的事件）：

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

---

## 4. 對照案例：閾值內的事件

如果同一個事件回報的是 `70°C`（低於 `temperatureThreshold: 80`）：

```text
70 > 80  →  false  →  no status change, no healthScore delta
                   →  currentTemperature: 70
                   →  lastEventId / lastUpdatedAt still update
```

依 `machine-schema.md` §4.3 與 §5.2，`status` 維持 `RUNNING`、`healthScore` 維持 `88` — 只有 `currentTemperature`、`lastEventId` 與 `lastUpdatedAt` 改變。Alert Service 不建立告警。這才是常態；大多數 `TEMPERATURE_REPORTED` 事件應該長這樣，而不是 §3.3 的樣子。

---

## 5. 對照案例：嚴重度優先序的實際運作

假設 `M-001` 在一個隱含 `WARNING`（等級 2）的 `TEMPERATURE_REPORTED` 事件抵達時，已經處於 `ERROR`（等級 4）— 無論溫度是否跨越閾值：

```text
rank(WARNING) = 2  <  rank(ERROR) = 4  →  status stays ERROR
                                        →  healthScore delta still applies if temperature > threshold (-10)
```

這就是 `machine-schema.md` §4.2 規則的具體化：較低嚴重度事件所隱含的狀態被捨棄，但它的健康分數增減仍然套用（§5.2 的獨立性規則）。機台在儀表板上維持可見的 `ERROR`，直到一個明確的 `STATUS_CHANGED` 事件解除它。

---

## 6. 規則在哪裡

本文件只做示範。權威規則在：

| 關注點 | 來源 |
| --- | --- |
| 事件信封與 payload 形狀 | `event-schema.md` §3、§5 |
| 狀態嚴重度排序與轉移 | `machine-schema.md` §4 |
| 健康分數增減與上下界 | `machine-schema.md` §5 |
| API 請求/回應契約 | `api.md` §4 |
| 一致性與冪等性保證 | `architecture.md` §15、`machine-schema.md` §8 |
