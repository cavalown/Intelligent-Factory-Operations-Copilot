# machine-state-projection 規格

## 目的
TBD - 由歸檔變更 backend-walking-skeleton 建立。歸檔後更新 Purpose。
## 需求
### 需求：溫度超過閾值時更新投影
系統在消費 `payload.temperature` 超過機台 `temperatureThreshold` 的 `TEMPERATURE_REPORTED` 事件時，SHALL 把機台 `status` 提升為 `WARNING`（受嚴重度優先序約束）並把 `healthScore` 減 10、截限在 `[0, 100]`，依 `docs/design/machine-schema.md` §4-§5。

#### 情境：超過閾值的溫度提升狀態並降低健康分數
- **WHEN** Machine Service 消費 `M-001` 的 `TEMPERATURE_REPORTED` 事件，`temperature` 高於 `M-001` 的 `temperatureThreshold`，且 `M-001` 目前狀態的嚴重度等級不高於 `WARNING`
- **THEN** `M-001` 的 `status` 變為 `WARNING`、`healthScore` 減 10（下限截在 0）、`currentTemperature` 設為回報值，且 `lastEventId`/`lastUpdatedAt` 更新

### 需求：閾值內時不改變狀態或健康分數
當回報的溫度在閾值內時，系統 SHALL 只更新 `currentTemperature`、`lastEventId` 與 `lastUpdatedAt`。

#### 情境：閾值內的溫度只更新遙測
- **WHEN** Machine Service 消費某機台的 `TEMPERATURE_REPORTED` 事件，`temperature` 等於或低於其 `temperatureThreshold`
- **THEN** 該機台的 `status` 與 `healthScore` 維持不變，但 `currentTemperature`、`lastEventId` 與 `lastUpdatedAt` 更新

### 需求：嚴重度優先序被強制執行
系統 SHALL NOT 透過 `TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED` 或 `PRODUCTION_COMPLETED` 事件把機台狀態降到較低嚴重度的值。系統在消費 `STATUS_CHANGED` 事件時 SHALL 一律把 `machine.status` 設為 `payload.currentStatus`，不論目前狀態的嚴重度等級 — 這是唯一被允許降級狀態的事件類型，依 `docs/design/machine-schema.md` §4.2。

#### 情境：較低嚴重度的事件不會降級較高嚴重度的狀態
- **WHEN** Machine Service 為目前處於 `ERROR` 狀態的機台消費一個隱含 `WARNING` 的 `TEMPERATURE_REPORTED` 事件
- **THEN** 該機台的 `status` 維持 `ERROR`，但若 `temperature` 超過閾值，`healthScore` 仍減 10

#### 情境：STATUS_CHANGED 不論等級一律覆寫狀態
- **WHEN** Machine Service 為目前處於 `ERROR` 狀態的機台消費 `payload.currentStatus: "RUNNING"` 的 `STATUS_CHANGED` 事件
- **THEN** 該機台的 `status` 變為 `RUNNING`

### 需求：對緊接重複的 eventId 冪等
系統 SHALL NOT 為與機台目前 `lastEventId` 相同的 `eventId` 重新套用狀態/健康分數變更。

#### 情境：重複的 eventId 不會重複套用
- **WHEN** Machine Service 消費的事件其 `eventId` 與機台目前的 `lastEventId` 相同
- **THEN** 它不會第二次重新套用狀態/healthScore 變更

### 需求：機台狀態可查詢
系統 SHALL 曝露 `GET /machines` 與 `GET /machines/:id`，回傳目前的機台投影，依 `docs/design/api.md` §4.1-4.2。

#### 情境：列出所有機台
- **WHEN** 客戶端 GET `/machines`
- **THEN** 系統回傳每台已 seed 機台的目前投影

#### 情境：取得單一機台
- **WHEN** 客戶端 GET `/machines/M-001`
- **THEN** 系統回傳 `M-001` 的目前投影

#### 情境：未知機台回傳 404
- **WHEN** 客戶端對不存在的 `machineId` GET `/machines/:id`
- **THEN** 系統回應 `404`、錯誤代碼 `MACHINE_NOT_FOUND`

### 需求：套用 STATUS_CHANGED 的健康分數規則
系統在消費 `payload.currentStatus` 為 `WARNING` 的 `STATUS_CHANGED` 事件時，SHALL 把 `healthScore` 減 15、截限在 `[0, 100]`。依本變更的設計決策，任何把 `currentStatus` 設為 `WARNING` 的 `STATUS_CHANGED` 事件都視為 `docs/design/machine-schema.md` §7 所指的「感測器故障」情況，不檢查 `payload.reason` 的文字。其他任何 `currentStatus` 值不因此事件產生健康分數變更。

#### 情境：STATUS_CHANGED 到 WARNING 降低健康分數
- **WHEN** Machine Service 消費 `payload.currentStatus: "WARNING"` 的 `STATUS_CHANGED` 事件
- **THEN** 該機台的 `healthScore` 減 15（下限截在 0）

#### 情境：STATUS_CHANGED 到非 WARNING 狀態時健康分數不變
- **WHEN** Machine Service 消費 `payload.currentStatus: "RUNNING"` 的 `STATUS_CHANGED` 事件
- **THEN** 該機台的 `healthScore` 不因此事件改變

### 需求：ERROR_OCCURRED 時更新投影
系統在消費 `ERROR_OCCURRED` 事件時，SHALL 把機台 `status` 提升為 `ERROR`（受嚴重度優先序約束）並把 `healthScore` 減 30、截限在 `[0, 100]`。

#### 情境：錯誤事件提升狀態並降低健康分數
- **WHEN** Machine Service 為目前嚴重度等級不高於 `ERROR` 的機台消費 `ERROR_OCCURRED` 事件
- **THEN** 該機台的 `status` 變為 `ERROR`、`healthScore` 減 30（下限截在 0），且 `lastEventId`/`lastUpdatedAt` 更新

### 需求：MAINTENANCE_REQUIRED 時更新投影
系統在消費 `MAINTENANCE_REQUIRED` 事件時，SHALL 把機台 `status` 提升為 `MAINTENANCE`（受嚴重度優先序約束）並把 `healthScore` 減 20、截限在 `[0, 100]`。

#### 情境：維護事件提升狀態並降低健康分數
- **WHEN** Machine Service 為目前嚴重度等級不高於 `MAINTENANCE` 的機台消費 `MAINTENANCE_REQUIRED` 事件
- **THEN** 該機台的 `status` 變為 `MAINTENANCE`、`healthScore` 減 20（下限截在 0），且 `lastEventId`/`lastUpdatedAt` 更新

### 需求：PRODUCTION_COMPLETED 時更新投影
系統在消費 `PRODUCTION_COMPLETED` 事件時，SHALL 把機台 `status` 提升為 `RUNNING`（受嚴重度優先序約束）、把 `healthScore` 加 2（截限在 `[0, 100]`），並把 `productionCount` 增加 `payload.quantity`。

#### 情境：生產事件更新數量、狀態與健康分數
- **WHEN** Machine Service 為目前處於 `RUNNING` 或 `IDLE` 狀態的機台消費 `payload.quantity: 5` 的 `PRODUCTION_COMPLETED` 事件
- **THEN** 該機台的 `status` 變為 `RUNNING`、`healthScore` 加 2（上限截在 100）、`productionCount` 增加 5，且 `lastEventId`/`lastUpdatedAt` 更新

#### 情境：生產事件不會降級較高嚴重度的狀態
- **WHEN** Machine Service 為目前處於 `ERROR` 狀態的機台消費 `PRODUCTION_COMPLETED` 事件
- **THEN** 該機台的 `status` 維持 `ERROR`，但 `healthScore` 仍加 2，`productionCount` 仍增加 `payload.quantity`

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

### 需求：temperature 無效時 TEMPERATURE_REPORTED 不毀損 currentTemperature
當 `temperature` 不是有限數值時，系統 SHALL NOT 把 `payload.temperature` 套用到 `currentTemperature`、`status` 或 `healthScore`。

#### 情境：非有限的 temperature 不被套用
- **WHEN** Machine Service 消費的 `TEMPERATURE_REPORTED` 事件其 `payload.temperature` 缺失或不是有限數值
- **THEN** `currentTemperature`、`status` 與 `healthScore` 維持不變，且該事件被記錄為已跳過
