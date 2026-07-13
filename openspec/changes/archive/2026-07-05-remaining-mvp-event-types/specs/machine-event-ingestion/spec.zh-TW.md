## 修改的需求

### 需求：拒絕不支援的事件類型
系統 SHALL 拒絕 5 種 MVP 事件類型（`STATUS_CHANGED`、`TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED`）之外的任何 `eventType`，且不發布到 Kafka。

#### 情境：不支援的事件類型
- **WHEN** 客戶端 POST 的事件信封其 `eventType` 在 5 種 MVP 事件類型之外
- **THEN** 系統回應 `422`、錯誤代碼 `UNSUPPORTED_EVENT_TYPE`，且不發布到 Kafka

### 需求：拒絕未通過綱要驗證的 payload
系統 SHALL 拒絕 payload 不符合其 `eventType` 所要求綱要的任何事件，依 `docs/design/event-schema.md` §9.2（`STATUS_CHANGED` 要求 `currentStatus`；`TEMPERATURE_REPORTED` 要求 `temperature`、`unit`；`ERROR_OCCURRED` 要求 `errorCode`、`errorMessage`；`MAINTENANCE_REQUIRED` 要求 `maintenanceType`、`reason`；`PRODUCTION_COMPLETED` 要求 `quantity`），且不發布到 Kafka。

#### 情境：無效的 TEMPERATURE_REPORTED payload
- **WHEN** 客戶端 POST 的 `TEMPERATURE_REPORTED` 事件其 payload 缺少 `temperature` 或 `unit`
- **THEN** 系統回應 `422`、錯誤代碼 `PAYLOAD_VALIDATION_FAILED`，且不發布到 Kafka

#### 情境：無效的 STATUS_CHANGED payload
- **WHEN** 客戶端 POST 的 `STATUS_CHANGED` 事件其 payload 缺少 `currentStatus`
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

## 新增的需求

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
