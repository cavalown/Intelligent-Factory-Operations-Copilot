## 新增的需求

### 需求：temperature 無效的 TEMPERATURE_REPORTED 不建立格式錯誤的告警
當 `TEMPERATURE_REPORTED` 事件的 `payload.temperature` 缺失或不是有限數值時，系統 SHALL NOT 建立告警。

#### 情境：缺 temperature 不建立告警
- **WHEN** Alert Service 消費的 `TEMPERATURE_REPORTED` 事件其 `payload.temperature` 缺失或不是有限數值
- **THEN** 不建立告警文件，且該事件被記錄為已跳過
