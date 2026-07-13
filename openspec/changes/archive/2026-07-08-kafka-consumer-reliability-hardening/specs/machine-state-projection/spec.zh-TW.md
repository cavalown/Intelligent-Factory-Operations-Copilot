## 新增的需求

### 需求：無法辨識的事件類型不更新投影、也不把自己標記為已處理
系統在消費 `eventType` 不屬於 5 種已知 MVP 事件類型的事件時，SHALL 跳過任何機台欄位的更新，且 SHALL NOT 更新 `lastEventId`/`lastUpdatedAt`。

#### 情境：未知事件類型被跳過且不被標記為已處理
- **WHEN** Machine Service 消費的事件其 `eventType` 不符合 `STATUS_CHANGED`、`TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED` 任一
- **THEN** 機台文件不被修改，且之後帶不同 `eventId` 的有效事件仍照常處理（即被跳過的事件沒有推進 `lastEventId`）

### 需求：quantity 無效時 PRODUCTION_COMPLETED 不毀損 productionCount
當 `quantity` 不是有限數值時，系統 SHALL NOT 把 `payload.quantity` 套用到 `productionCount`。

#### 情境：非數字的 quantity 不被套用
- **WHEN** Machine Service 消費的 `PRODUCTION_COMPLETED` 事件其 `payload.quantity` 缺失或不是有限數值
- **THEN** `productionCount` 維持不變（不會被設為 `NaN`），且該事件被記錄為已跳過
