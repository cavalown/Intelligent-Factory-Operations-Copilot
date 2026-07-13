## 修改的需求

### 需求：嚴重度優先序被強制執行
系統 SHALL NOT 透過 `TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED` 或 `PRODUCTION_COMPLETED` 事件把機台狀態降到較低嚴重度的值。系統在消費 `STATUS_CHANGED` 事件時 SHALL 一律把 `machine.status` 設為 `payload.currentStatus`，不論目前狀態的嚴重度等級 — 這是唯一被允許降級狀態的事件類型，依 `docs/design/machine-schema.md` §4.2。

#### 情境：較低嚴重度的事件不會降級較高嚴重度的狀態
- **WHEN** Machine Service 為目前處於 `ERROR` 狀態的機台消費一個隱含 `WARNING` 的 `TEMPERATURE_REPORTED` 事件
- **THEN** 該機台的 `status` 維持 `ERROR`，但若 `temperature` 超過閾值，`healthScore` 仍減 10

#### 情境：STATUS_CHANGED 不論等級一律覆寫狀態
- **WHEN** Machine Service 為目前處於 `ERROR` 狀態的機台消費 `payload.currentStatus: "RUNNING"` 的 `STATUS_CHANGED` 事件
- **THEN** 該機台的 `status` 變為 `RUNNING`

## 新增的需求

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
