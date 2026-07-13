## 修改的需求

### 需求：拒絕無效的信封
系統 SHALL 拒絕信封缺少必要欄位、或 `schemaVersion` 欄位不是數字的請求，且不發布到 Kafka。

#### 情境：缺少必要信封欄位
- **WHEN** 客戶端 POST 一個缺少必要欄位（例如 `occurredAt`）的事件信封
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE`，且不發布到 Kafka

#### 情境：非數字的 schemaVersion
- **WHEN** 客戶端 POST 的事件信封其 `schemaVersion` 不是數字（例如字串）
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE`，且不發布到 Kafka

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
