# 事件綱要（Event Schema）

## 1. 目的

本文件定義 **IFOC（Intelligent Factory Operations Copilot，智慧工廠營運助理）** 的機台事件格式。

機台事件代表工廠中已經發生的事實。它們是事件歷史、機台狀態投影、告警、AI 洞察，以及未來 Digital Twin 重播的基礎。

本文件為後端、Kafka consumer、儀表板與 AI insight 模組建立共同契約，讓系統的每個部分都基於同一種事件格式運作。

事件綱要應支援：

* 機台事件攝取。
* 以 Kafka 為基礎的非同步處理。
* 事件歷史持久化。
* 機台目前狀態投影。
* 告警偵測。
* AI 洞察產生。
* 未來的預測性維護與 Digital Twin 工作流程。

在 IFOC 中，原始機台事件應描述發生了什麼。它們不應包含每一種下游詮釋。例如，原始的 `TEMPERATURE_REPORTED` 事件記錄一筆溫度讀值。由 consumer 或規則決定該讀值是否應成為警告告警。

---

## 2. 事件設計原則

1. **事件描述已經發生的事實。**  
   事件應描述真實的機台狀況或操作，不是 UI 動作或暫時性命令。

2. **事件是不可變的。**  
   事件一旦被接受，就不應被更改為代表不同的事實。

3. **事件應有版本。**  
   每個事件包含 `schemaVersion`，讓 consumer 能安全演進。

4. **事件應包含可追溯的中繼資料。**  
   事件應包含識別碼與時間戳記，讓系統能追溯事件來自哪裡、何時發生。

5. **事件應能安全地非同步處理。**  
   Consumer 應能獨立且冪等地處理事件。

6. **事件應把事實與詮釋分開。**  
   原始事件不應包含衍生欄位（例如告警嚴重度），除非該嚴重度是上游機台事實的一部分。MVP 中，告警嚴重度由 consumer 推導。

---

## 3. 事件信封（Event Envelope）

所有機台事件使用共同的信封。

信封包含用於路由、追溯、驗證與版本管理的共通欄位。事件特有的資料存放在 `payload`。

所有事件應有相同的外層結構。各事件類型之間唯一會變的部分是：

* `eventType`
* `payload`

這讓 producer、Kafka 訊息、consumer、驗證器與儲存邏輯保持一致。

```json
{
  "eventId": "evt_01J2Z7X9K8V6P4M3N2Q1R0T9Y8",
  "eventType": "TEMPERATURE_REPORTED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-001",
  "occurredAt": "2026-07-02T10:30:00.000Z",
  "producedAt": "2026-07-02T10:30:01.000Z",
  "correlationId": "corr_01J2Z7X9K8V6P4M3N2Q1R0T9Y8",
  "payload": {
    "temperature": 95,
    "unit": "C"
  }
}
```

### 3.1 信封欄位

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `eventId` | string | 是 | 唯一事件識別碼。用於冪等性。 |
| `eventType` | string | 是 | 事件類型，例如 `TEMPERATURE_REPORTED`。 |
| `schemaVersion` | number | 是 | 此事件綱要的版本。MVP 值為 `1`。 |
| `source` | string | 是 | 事件的產生者。 |
| `machineId` | string | 是 | 產生或關聯此事件的機台。 |
| `occurredAt` | string | 是 | 事件發生時間，ISO 8601 UTC 格式。 |
| `producedAt` | string | 是 | producer 發布事件的時間。 |
| `correlationId` | string | 否 | 用於把相關事件或請求分組的追溯 ID。 |
| `payload` | object | 是 | 事件特有的資料。 |

### 3.2 為什麼原始事件裡沒有 `severity`

MVP 的原始機台事件不包含 `severity`。

原因：

```text
eventType / payload = fact
severity / alert / machine status = interpretation
```

範例：

```json
{
  "eventType": "TEMPERATURE_REPORTED",
  "payload": {
    "temperature": 95,
    "unit": "C"
  }
}
```

事件只說回報了一個溫度。由 Alert Service 或 Machine Service 依系統規則決定 `95 C` 是正常、警告還是嚴重。

這讓 producer 的責任保持簡單，並避免商業邏輯在各 producer 之間重複。

---

## 4. 事件類型

MVP 使用描述機台事實的事件類型。

| 事件類型 | 意義 | 典型的 consumer 詮釋 |
| --- | --- | --- |
| `STATUS_CHANGED` | 機台狀態改變。 | 更新機台目前狀態。 |
| `TEMPERATURE_REPORTED` | 機台回報溫度讀值。 | 更新溫度；可能建立警告告警。 |
| `ERROR_OCCURRED` | 機台回報錯誤狀況。 | 標記機台為錯誤；建立嚴重告警。 |
| `MAINTENANCE_REQUIRED` | 機台回報需要維護。 | 標記機台為維護；建立警告告警。 |
| `PRODUCTION_COMPLETED` | 機台完成一個生產週期或批次。 | 增加生產數量；更新健康分數。 |

事件類型應使用大寫蛇形命名（uppercase snake case）。

---

## 5. 事件 Payload 綱要

每種事件類型有自己的 `payload` 綱要。

### 5.1 `STATUS_CHANGED`

機台改變運轉狀態時使用。

```json
{
  "previousStatus": "IDLE",
  "currentStatus": "RUNNING",
  "reason": "Production cycle started."
}
```

欄位：

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `previousStatus` | string | 否 | 先前的機台狀態。 |
| `currentStatus` | string | 是 | 新的機台狀態。 |
| `reason` | string | 否 | 人類可讀的變更原因。 |

允許的機台狀態：

```text
RUNNING
IDLE
WARNING
ERROR
MAINTENANCE
```

### 5.2 `TEMPERATURE_REPORTED`

機台回報溫度讀值時使用。

```json
{
  "temperature": 95,
  "unit": "C"
}
```

欄位：

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `temperature` | number | 是 | 回報的機台溫度。 |
| `unit` | string | 是 | 溫度單位。MVP 值為 `C`。 |

MVP 的原始事件不包含閾值。閾值屬於 consumer 規則或機台設定。

### 5.3 `ERROR_OCCURRED`

機台回報錯誤時使用。

```json
{
  "errorCode": "E_STOP_MANUAL",
  "errorMessage": "Operator pressed emergency stop.",
  "recoverable": true
}
```

欄位：

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `errorCode` | string | 是 | 機台或 simulator 的錯誤代碼。 |
| `errorMessage` | string | 是 | 人類可讀的錯誤訊息。 |
| `recoverable` | boolean | 否 | 機台是否能在不維護的情況下復原。 |

### 5.4 `MAINTENANCE_REQUIRED`

機台需要維護或檢查時使用。

```json
{
  "maintenanceType": "INSPECTION",
  "reason": "Scheduled maintenance threshold reached."
}
```

欄位：

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `maintenanceType` | string | 是 | 所需的維護類型。 |
| `reason` | string | 是 | 需要維護的原因。 |

### 5.5 `PRODUCTION_COMPLETED`

機台完成生產時使用。

```json
{
  "quantity": 1,
  "batchId": "BATCH-20260702-001"
}
```

欄位：

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `quantity` | number | 是 | 生產的單位數或完成的週期數。 |
| `batchId` | string | 否 | 生產批次識別碼。 |

---

## 6. 事件 Producer

事件 producer 建立機台事件並發布到 Kafka。

### 6.1 MVP Producer

| Producer | 說明 |
| --- | --- |
| Machine Simulator | 為本機開發與 demo 產生假的機台事件。 |

### 6.2 未來的 Producer

| Producer | 說明 |
| --- | --- |
| PLC 整合 | 發布來自可程式邏輯控制器的事件。 |
| MES 整合 | 發布生產與製造執行事件。 |
| SCADA 整合 | 發布監控控制與警報事件。 |
| IoT Gateway | 發布來自邊緣裝置的感測器讀值。 |
| Digital Twin Simulator | 發布模擬的機台狀態變更。 |

Producer 應專注於事實。它們不應重複下游的告警或洞察邏輯。

### 6.3 事件觸發時機

Producer 不應盲目地按固定間隔發布事件。事件何時發布取決於它代表哪種事實。

**離散事實**（`STATUS_CHANGED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED`）由事件觸發。事實發生的那一刻，producer 恰好發布一個事件 — 狀態真的變了、錯誤真的發生了。這些事件沒有週期性的形式。

**連續量測**（`TEMPERATURE_REPORTED` 與未來類似的感測器讀值）來自可以連續取樣的感測器，但 producer 不應把每個樣本都轉成 Kafka 事件。發布應採**例外回報（report-by-exception）**：只有當讀值相對於上次回報的值跨越死區（deadband）閾值，或距上次發布已超過最大回報間隔且值無變化時才發布。這讓事件量與真實的營運活動成比例，而不是與感測器取樣率成比例。

```text
sample continuously
    -> did value change beyond deadband threshold since last reported value?
        yes -> publish TEMPERATURE_REPORTED
        no  -> did maxReportInterval elapse since last publish?
            yes -> publish TEMPERATURE_REPORTED (heartbeat)
            no  -> do not publish
```

MVP 中，Machine Simulator 透過儀表板的 simulator 控制項隨需發布事件，所以此規則尚不適用。當真實的 producer（PLC、IoT Gateway、OPC UA）在後續階段取代 simulator 時它就變得相關 — 見 `docs/design/architecture.md` 第 17 節、Phase 5。

---

## 7. 事件 Consumer

事件 consumer 對機台事件做出反應。

| Consumer | 職責 |
| --- | --- |
| Event Service | 儲存完整不可變的事件歷史。 |
| Machine Service | 建立機台目前狀態投影。 |
| Alert Service | 套用規則，必要時建立告警。 |
| Insight Service | 為 AI 摘要準備事件脈絡。 |
| 未來的 Predictive Maintenance Service | 從事件歷史偵測風險模式。 |
| 未來的 Digital Twin Service | 更新模擬的工廠狀態。 |

MVP 中，這些 consumer 可以實作在同一個 NestJS 後端程序內。重要的設計邊界不變：每個 consumer 有自己的職責。

---

## 8. Kafka Topic

MVP 使用一個主要 topic：

```text
machine.events
```

建議的訊息 key：

```text
machineId
```

用 `machineId` 作為 Kafka 訊息 key，有助於在分割區內保留同一機台事件的順序。

### 8.1 Topic 命名慣例

Topic 名稱應使用小寫點記法：

```text
<domain>.<event-stream>
```

範例：

```text
machine.events
machine.status.updated
machine.alerts.created
insight.summary.generated
maintenance.prediction.generated
digital-twin.state.updated
```

衍生 topic 只應在有真實 consumer 邊界時才新增。

---

## 9. 驗證規則

所有進來的事件必須通過驗證，才能被儲存或用於投影。

### 9.1 信封驗證

必要欄位：

* `eventId`
* `eventType`
* `schemaVersion`
* `source`
* `machineId`
* `occurredAt`
* `producedAt`
* `payload`

規則：

* `eventId` 必須唯一。
* `eventType` 必須是支援的類型。
* `schemaVersion` 必須是 consumer 支援的版本。
* `machineId` 必須存在且非空。
* `occurredAt` 必須是合法的 ISO 8601 時間戳記。
* `producedAt` 必須是合法的 ISO 8601 時間戳記。
* `payload` 必須符合 `eventType` 的綱要。

### 9.2 Payload 驗證

| 事件類型 | 必要 Payload 欄位 |
| --- | --- |
| `STATUS_CHANGED` | `currentStatus` |
| `TEMPERATURE_REPORTED` | `temperature`、`unit` |
| `ERROR_OCCURRED` | `errorCode`、`errorMessage` |
| `MAINTENANCE_REQUIRED` | `maintenanceType`、`reason` |
| `PRODUCTION_COMPLETED` | `quantity` |

無效事件不應更新投影。

---

## 10. 版本管理策略

MVP 使用：

```text
schemaVersion = 1
```

版本管理規則：

* 儘可能新增選填欄位。
* 不改變既有欄位的意義。
* 不移除仍被作用中 consumer 使用的欄位。
* 不相容的變更引入新的 `schemaVersion`。
* Consumer 應明確拒絕不支援的綱要版本。

相容變更範例：

```text
Add optional payload.batchId to PRODUCTION_COMPLETED.
```

不相容變更範例：

```text
Rename machineId to assetId without supporting both fields.
```

---

## 11. 事件範例

### 11.1 `TEMPERATURE_REPORTED`

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

可能的 consumer 詮釋：

```text
Machine Service:
  currentTemperature = 95
  status = WARNING if threshold is exceeded

Alert Service:
  create warning alert if temperature exceeds configured threshold

Insight Service:
  include event in recent machine context
```

### 11.2 `ERROR_OCCURRED`

```json
{
  "eventId": "evt_error_001",
  "eventType": "ERROR_OCCURRED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-002",
  "occurredAt": "2026-07-02T10:35:00.000Z",
  "producedAt": "2026-07-02T10:35:01.000Z",
  "correlationId": "corr_demo_002",
  "payload": {
    "errorCode": "E_STOP_MANUAL",
    "errorMessage": "Operator pressed emergency stop.",
    "recoverable": true
  }
}
```

可能的 consumer 詮釋：

```text
Machine Service:
  status = ERROR
  healthScore decreases

Alert Service:
  create critical alert
```

### 11.3 `PRODUCTION_COMPLETED`

```json
{
  "eventId": "evt_prod_001",
  "eventType": "PRODUCTION_COMPLETED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-003",
  "occurredAt": "2026-07-02T10:40:00.000Z",
  "producedAt": "2026-07-02T10:40:01.000Z",
  "correlationId": "corr_demo_003",
  "payload": {
    "quantity": 1,
    "batchId": "BATCH-20260702-001"
  }
}
```

可能的 consumer 詮釋：

```text
Machine Service:
  productionCount increases
  status = RUNNING
  healthScore may increase slightly

Alert Service:
  no alert
```

### 11.4 `STATUS_CHANGED`

```json
{
  "eventId": "evt_status_001",
  "eventType": "STATUS_CHANGED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-004",
  "occurredAt": "2026-07-02T10:45:00.000Z",
  "producedAt": "2026-07-02T10:45:01.000Z",
  "correlationId": "corr_demo_004",
  "payload": {
    "previousStatus": "IDLE",
    "currentStatus": "RUNNING",
    "reason": "Production cycle started."
  }
}
```

---

## 12. 未來擴充

未來的事件類型可能支援更進階的工廠營運：

```text
QUALITY_CHECK_FAILED
ENERGY_USAGE_REPORTED
VIBRATION_REPORTED
WORK_ORDER_CREATED
SOP_RECOMMENDED
PREDICTIVE_MAINTENANCE_RISK_DETECTED
DIGITAL_TWIN_STATE_UPDATED
AGENT_INVESTIGATION_STARTED
AGENT_INVESTIGATION_COMPLETED
```

未來擴充應支援：

* 從歷史模式做預測性維護。
* Digital Twin 狀態重播與模擬。
* AI agent 調查工作流程。
* SOP 與 RAG 為基礎的建議。
* 與真實 PLC、MES、SCADA 和 IoT 資料來源整合。

每種新事件類型應定義：

* 事件目的。
* Payload 綱要。
* Producer。
* Consumer。
* 投影行為。
* 版本管理影響。
