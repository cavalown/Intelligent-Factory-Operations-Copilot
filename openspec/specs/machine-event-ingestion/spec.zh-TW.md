# machine-event-ingestion 規格

## 目的
TBD - 由歸檔變更 backend-walking-skeleton 建立。歸檔後更新 Purpose。
## 需求
### 需求：接受並發布有效的 TEMPERATURE_REPORTED 事件
系統 SHALL 依 `docs/design/event-schema.md` 驗證進來的事件信封與其 `TEMPERATURE_REPORTED` payload，並 SHALL 把有效事件以 `machineId` 為 key 發布到 `machine.events` Kafka topic。

#### 情境：有效事件被發布
- **WHEN** 客戶端為既有機台 POST 一個格式完好的 `TEMPERATURE_REPORTED` 事件信封到 `/simulator/events`
- **THEN** 系統把事件以 `machineId` 為 key 發布到 `machine.events` topic，並回應 `202 Accepted` 與 `{ eventId, status: "PUBLISHED" }`

### 需求：拒絕無效的信封
系統 SHALL 拒絕信封缺少必要欄位、或 `schemaVersion` 欄位不是數字的請求，且不發布到 Kafka。

#### 情境：缺少必要信封欄位
- **WHEN** 客戶端 POST 一個缺少必要欄位（例如 `occurredAt`）的事件信封
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE`，且不發布到 Kafka

#### 情境：非數字的 schemaVersion
- **WHEN** 客戶端 POST 的事件信封其 `schemaVersion` 不是數字（例如字串）
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE`，且不發布到 Kafka

### 需求：拒絕未知機台
系統 SHALL 拒絕引用未預先 seed 的 `machineId` 的事件，且不發布到 Kafka。

#### 情境：未知的 machineId
- **WHEN** 客戶端為 `machines` collection 中不存在的 `machineId` POST 一個有效的事件信封
- **THEN** 系統回應 `404`、錯誤代碼 `UNKNOWN_MACHINE`，且不發布到 Kafka

### 需求：拒絕不支援的事件類型
系統 SHALL 拒絕 5 種 MVP 事件類型（`STATUS_CHANGED`、`TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED`）之外的任何 `eventType`，且不發布到 Kafka。

#### 情境：不支援的事件類型
- **WHEN** 客戶端 POST 的事件信封其 `eventType` 在 5 種 MVP 事件類型之外
- **THEN** 系統回應 `422`、錯誤代碼 `UNSUPPORTED_EVENT_TYPE`，且不發布到 Kafka

### 需求：拒絕未通過綱要驗證的 payload
系統 SHALL 拒絕 payload 不符合其 `eventType` 所要求綱要的任何事件，依 `docs/design/event-schema.md` §9.2（`STATUS_CHANGED` 要求 `currentStatus` 屬於 5 種允許的機台狀態之一；`TEMPERATURE_REPORTED` 要求 `temperature`、`unit`；`ERROR_OCCURRED` 要求 `errorCode`、`errorMessage`；`MAINTENANCE_REQUIRED` 要求 `maintenanceType`、`reason`；`PRODUCTION_COMPLETED` 要求 `quantity`），且不發布到 Kafka。

#### 情境：無效的 TEMPERATURE_REPORTED payload
- **WHEN** 客戶端 POST 的 `TEMPERATURE_REPORTED` 事件其 payload 缺少 `temperature` 或 `unit`
- **THEN** 系統回應 `422`、錯誤代碼 `PAYLOAD_VALIDATION_FAILED`，且不發布到 Kafka

#### 情境：無效的 STATUS_CHANGED payload — 缺欄位
- **WHEN** 客戶端 POST 的 `STATUS_CHANGED` 事件其 payload 缺少 `currentStatus`
- **THEN** 系統回應 `422`、錯誤代碼 `PAYLOAD_VALIDATION_FAILED`，且不發布到 Kafka

#### 情境：無效的 STATUS_CHANGED payload — 無法辨識的狀態
- **WHEN** 客戶端 POST 的 `STATUS_CHANGED` 事件其 `payload.currentStatus` 是字串但不屬於 `RUNNING`、`IDLE`、`WARNING`、`ERROR`、`MAINTENANCE` 之一
- **THEN** 系統回應 `422`、錯誤代碼 `PAYLOAD_VALIDATION_FAILED`，且不發布到 Kafka

#### 情境：無效的 ERROR_OCCURRED payload
- **WHEN** 客戶端 POST 的 `ERROR_OCCURRED` 事件其 payload 缺少 `errorCode` 或 `errorMessage`
- **THEN** 系統回應 `422`、錯誤代碼 `PAYLOAD_VALIDATION_FAILED`，且不發布到 Kafka

#### 情境：無效的 MAINTENANCE_REQUIRED payload
- **WHEN** 客戶端 POST 的 `MAINTENANCE_REQUIRED` 事件其 payload 缺少 `maintenanceType` 或 `reason`
- **THEN** 系統回應 `422`、錯誤代碼 `PAYLOAD_VALIDATION_FAILED`，且不發布到 Kafka

#### 情境：無效的 PRODUCTION_COMPLETED payload
- **WHEN** 客戶端 POST 的 `PRODUCTION_COMPLETED` 事件其 payload 缺少 `quantity`
- **THEN** 系統回應 `422`、錯誤代碼 `PAYLOAD_VALIDATION_FAILED`，且不發布到 Kafka

### 需求：接受並發布有效的 STATUS_CHANGED 事件
系統 SHALL 依 `docs/design/event-schema.md` 驗證進來的事件信封與其 `STATUS_CHANGED` payload，並 SHALL 把有效事件以 `machineId` 為 key 發布到 `machine.events` Kafka topic。

#### 情境：有效事件被發布
- **WHEN** 客戶端為既有機台 POST 一個格式完好的 `STATUS_CHANGED` 事件信封到 `/simulator/events`
- **THEN** 系統把事件以 `machineId` 為 key 發布到 `machine.events` topic，並回應 `202 Accepted` 與 `{ eventId, status: "PUBLISHED" }`

### 需求：接受並發布有效的 ERROR_OCCURRED 事件
系統 SHALL 依 `docs/design/event-schema.md` 驗證進來的事件信封與其 `ERROR_OCCURRED` payload，並 SHALL 把有效事件以 `machineId` 為 key 發布到 `machine.events` Kafka topic。

#### 情境：有效事件被發布
- **WHEN** 客戶端為既有機台 POST 一個格式完好的 `ERROR_OCCURRED` 事件信封到 `/simulator/events`
- **THEN** 系統把事件以 `machineId` 為 key 發布到 `machine.events` topic，並回應 `202 Accepted` 與 `{ eventId, status: "PUBLISHED" }`

### 需求：接受並發布有效的 MAINTENANCE_REQUIRED 事件
系統 SHALL 依 `docs/design/event-schema.md` 驗證進來的事件信封與其 `MAINTENANCE_REQUIRED` payload，並 SHALL 把有效事件以 `machineId` 為 key 發布到 `machine.events` Kafka topic。

#### 情境：有效事件被發布
- **WHEN** 客戶端為既有機台 POST 一個格式完好的 `MAINTENANCE_REQUIRED` 事件信封到 `/simulator/events`
- **THEN** 系統把事件以 `machineId` 為 key 發布到 `machine.events` topic，並回應 `202 Accepted` 與 `{ eventId, status: "PUBLISHED" }`

### 需求：接受並發布有效的 PRODUCTION_COMPLETED 事件
系統 SHALL 依 `docs/design/event-schema.md` 驗證進來的事件信封與其 `PRODUCTION_COMPLETED` payload，並 SHALL 把有效事件以 `machineId` 為 key 發布到 `machine.events` Kafka topic。

#### 情境：有效事件被發布
- **WHEN** 客戶端為既有機台 POST 一個格式完好的 `PRODUCTION_COMPLETED` 事件信封到 `/simulator/events`
- **THEN** 系統把事件以 `machineId` 為 key 發布到 `machine.events` topic，並回應 `202 Accepted` 與 `{ eventId, status: "PUBLISHED" }`

### 需求：事件時間戳記必須是標準 ISO-8601 UTC
系統 SHALL 拒絕 `occurredAt` 或 `producedAt` 不是標準 ISO-8601 UTC 字串（`YYYY-MM-DDTHH:mm:ss.sssZ`）或無法解析為有效時刻的 simulator 事件，回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE` — 強制執行 `docs/design/api.md` §2.3 宣告的時間戳記慣例。下游消費者（視窗查詢、轉移排序、時長算術）MAY 依賴已儲存時間戳記的字典序等於時間序。

#### 情境：偏移量形式的時間戳記被拒絕
- **WHEN** 客戶端以 `occurredAt: "2026-07-11T10:00:00+00:00"` POST `/simulator/events`
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE`，且沒有任何東西被發布到 Kafka

#### 情境：無法解析的時間戳記被拒絕
- **WHEN** 客戶端 POST 的事件其 `occurredAt` 形狀吻合但不是真實時刻（例如 `"2026-13-01T00:00:00.000Z"`）或為空字串
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE`

#### 情境：標準時間戳記被接受
- **WHEN** 客戶端 POST 的事件其 `occurredAt`/`producedAt` 為 `YYYY-MM-DDTHH:mm:ss.sssZ` 形式
- **THEN** 驗證通過，事件照常發布
