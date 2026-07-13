## 新增的需求

### 需求：接受並發布有效的 TEMPERATURE_REPORTED 事件
系統 SHALL 依 `docs/design/event-schema.md` 驗證進來的事件信封與其 `TEMPERATURE_REPORTED` payload，並 SHALL 把有效事件以 `machineId` 為 key 發布到 `machine.events` Kafka topic。

#### 情境：有效事件被發布
- **WHEN** 客戶端為既有機台 POST 一個格式完好的 `TEMPERATURE_REPORTED` 事件信封到 `/simulator/events`
- **THEN** 系統把事件以 `machineId` 為 key 發布到 `machine.events` topic，並回應 `202 Accepted` 與 `{ eventId, status: "PUBLISHED" }`

### 需求：拒絕無效的信封
系統 SHALL 拒絕信封缺少必要欄位的請求，且不發布到 Kafka。

#### 情境：缺少必要信封欄位
- **WHEN** 客戶端 POST 一個缺少必要欄位（例如 `occurredAt`）的事件信封
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE`，且不發布到 Kafka

### 需求：拒絕未知機台
系統 SHALL 拒絕引用未預先 seed 的 `machineId` 的事件，且不發布到 Kafka。

#### 情境：未知的 machineId
- **WHEN** 客戶端為 `machines` collection 中不存在的 `machineId` POST 一個有效的事件信封
- **THEN** 系統回應 `404`、錯誤代碼 `UNKNOWN_MACHINE`，且不發布到 Kafka

### 需求：拒絕不支援的事件類型
系統 SHALL 拒絕 `TEMPERATURE_REPORTED` 以外的任何 `eventType`，且不發布到 Kafka。其餘 MVP 事件類型的支援由後續變更加入。

#### 情境：不支援的事件類型
- **WHEN** 客戶端 POST 的事件信封其 `eventType` 不是 `TEMPERATURE_REPORTED`
- **THEN** 系統回應 `422`、錯誤代碼 `UNSUPPORTED_EVENT_TYPE`，且不發布到 Kafka

### 需求：拒絕未通過綱要驗證的 payload
系統 SHALL 拒絕 payload 不符合必要綱要（`temperature`、`unit`）的 `TEMPERATURE_REPORTED` 事件，且不發布到 Kafka。

#### 情境：無效的 payload
- **WHEN** 客戶端 POST 的 `TEMPERATURE_REPORTED` 事件其 payload 缺少 `temperature` 或 `unit`
- **THEN** 系統回應 `422`、錯誤代碼 `PAYLOAD_VALIDATION_FAILED`，且不發布到 Kafka
