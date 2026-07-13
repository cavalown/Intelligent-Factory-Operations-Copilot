## 新增的需求

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
系統 SHALL NOT 把機台狀態降到較低嚴重度的值；只有 `STATUS_CHANGED` 事件可以這麼做（不在本變更範圍）。

#### 情境：較低嚴重度的事件不會降級較高嚴重度的狀態
- **WHEN** Machine Service 為目前處於 `ERROR` 狀態的機台消費一個隱含 `WARNING` 的 `TEMPERATURE_REPORTED` 事件
- **THEN** 該機台的 `status` 維持 `ERROR`，但若 `temperature` 超過閾值，`healthScore` 仍減 10

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
