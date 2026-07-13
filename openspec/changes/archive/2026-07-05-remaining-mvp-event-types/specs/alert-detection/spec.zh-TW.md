## 新增的需求

### 需求：ERROR_OCCURRED 時建立 CRITICAL 告警
系統在消費 `ERROR_OCCURRED` 事件時，SHALL 建立 `severity: CRITICAL`、`status: ACTIVE` 的告警，不論 `payload.recoverable` 為何。

#### 情境：錯誤事件建立告警
- **WHEN** Alert Service 消費 `M-002` 的 `ERROR_OCCURRED` 事件
- **THEN** 建立一份告警文件，帶有 `machineId: M-002`、與來源事件相符的 `eventId`、`severity: CRITICAL`、`status: ACTIVE`，以及人類可讀的 `message`

### 需求：MAINTENANCE_REQUIRED 時建立 WARNING 告警
系統在消費 `MAINTENANCE_REQUIRED` 事件時，SHALL 建立 `severity: WARNING`、`status: ACTIVE` 的告警。

#### 情境：維護事件建立告警
- **WHEN** Alert Service 消費某機台的 `MAINTENANCE_REQUIRED` 事件
- **THEN** 建立一份告警文件，帶有 `severity: WARNING`、`status: ACTIVE`，以及人類可讀的 `message`

### 需求：STATUS_CHANGED 時有條件地建立 WARNING 告警
系統在消費 `payload.currentStatus` 為 `WARNING` 的 `STATUS_CHANGED` 事件時 SHALL 建立 `severity: WARNING`、`status: ACTIVE` 的告警，對其他任何 `currentStatus` 值 SHALL NOT 建立告警，依本變更關於感測器故障偵測的設計決策。

#### 情境：STATUS_CHANGED 設為 WARNING 時建立告警
- **WHEN** Alert Service 消費 `payload.currentStatus: "WARNING"` 的 `STATUS_CHANGED` 事件
- **THEN** 建立 `severity: WARNING`、`status: ACTIVE` 的告警文件

#### 情境：非 WARNING 的 STATUS_CHANGED 不建立告警
- **WHEN** Alert Service 消費 `payload.currentStatus: "RUNNING"` 的 `STATUS_CHANGED` 事件
- **THEN** 不建立告警文件

### 需求：PRODUCTION_COMPLETED 不建立告警
系統在消費 `PRODUCTION_COMPLETED` 事件時 SHALL NOT 建立告警。

#### 情境：生產完成不建立告警
- **WHEN** Alert Service 消費 `PRODUCTION_COMPLETED` 事件
- **THEN** 不建立告警文件
