## 修改的需求

### 需求：不可變地持久化已消費的事件
系統 SHALL 從 `machine.events` Kafka topic 消費任何 MVP 事件類型（`STATUS_CHANGED`、`TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED`）的事件，並把每個事件持久化為 `machine_events` collection 中的不可變文件，完整保留事件信封不變。

#### 情境：消費時持久化事件
- **WHEN** Event Service 從 `machine.events` 消費一個 `TEMPERATURE_REPORTED` 事件
- **THEN** 它在 `machine_events` 儲存一份文件，包含所有信封欄位（`eventId`、`eventType`、`schemaVersion`、`source`、`machineId`、`occurredAt`、`producedAt`、`correlationId`、`payload`）且未經更改

#### 情境：非溫度事件類型以相同方式持久化
- **WHEN** Event Service 從 `machine.events` 消費 `STATUS_CHANGED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED` 或 `PRODUCTION_COMPLETED` 事件
- **THEN** 它在 `machine_events` 儲存一份包含所有信封欄位且未經更改的文件，使用與 `TEMPERATURE_REPORTED` 相同的持久化邏輯
