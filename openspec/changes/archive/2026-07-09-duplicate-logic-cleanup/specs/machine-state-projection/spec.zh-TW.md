## 新增的需求

### 需求：temperature 無效時 TEMPERATURE_REPORTED 不毀損 currentTemperature
當 `temperature` 不是有限數值時，系統 SHALL NOT 把 `payload.temperature` 套用到 `currentTemperature`、`status` 或 `healthScore`。

#### 情境：非有限的 temperature 不被套用
- **WHEN** Machine Service 消費的 `TEMPERATURE_REPORTED` 事件其 `payload.temperature` 缺失或不是有限數值
- **THEN** `currentTemperature`、`status` 與 `healthScore` 維持不變，且該事件被記錄為已跳過
