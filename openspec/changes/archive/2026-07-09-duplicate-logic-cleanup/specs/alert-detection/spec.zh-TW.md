## 新增的需求

### 需求：無法辨識的事件類型不建立告警
系統在消費 `eventType` 不屬於 5 種已知 MVP 事件類型的事件時 SHALL NOT 建立告警，且 SHALL 記錄該次跳過。

#### 情境：未知事件類型不產生告警
- **WHEN** Alert Service 消費的事件其 `eventType` 不符合 `STATUS_CHANGED`、`TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED` 任一
- **THEN** 不建立告警文件，且該事件被記錄為已跳過
