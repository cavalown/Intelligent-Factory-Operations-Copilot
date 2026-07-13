# alert-detection 規格

## 目的
TBD - 由歸檔變更 backend-walking-skeleton 建立。歸檔後更新 Purpose。
## 需求
### 需求：溫度超過閾值時建立 WARNING 告警
系統在消費 `payload.temperature` 超過機台 `temperatureThreshold` 的 `TEMPERATURE_REPORTED` 事件時，SHALL 建立 `severity: WARNING`、`status: ACTIVE` 的告警，依 `CLAUDE.md` 的告警規則與 `docs/design/architecture.md` §9.3。

#### 情境：超過閾值的溫度建立告警
- **WHEN** Alert Service 消費 `M-001` 的 `TEMPERATURE_REPORTED` 事件，`temperature` 高於 `M-001` 的 `temperatureThreshold`
- **THEN** 建立一份告警文件，帶有 `machineId: M-001`、與來源事件相符的 `eventId`、`severity: WARNING`、`status: ACTIVE`，以及人類可讀的 `message`

### 需求：閾值內不建立告警
系統 SHALL NOT 為閾值內的 `TEMPERATURE_REPORTED` 事件建立告警。

#### 情境：正常範圍溫度不建立告警
- **WHEN** Alert Service 消費 `temperature` 等於或低於機台 `temperatureThreshold` 的 `TEMPERATURE_REPORTED` 事件
- **THEN** 不建立告警文件

### 需求：對重複的 eventId 冪等
系統 SHALL NOT 為已經產生過告警的 `eventId` 建立第二份告警。

#### 情境：重複事件不建立重複告警
- **WHEN** Alert Service 消費的事件其 `eventId` 在 `alerts` collection 中已有對應告警
- **THEN** 不建立第二份告警

### 需求：告警可按機台查詢
系統 SHALL 曝露 `GET /machines/:id/alerts`，可選擇以 `status` 篩選，依 `docs/design/api.md` §4.4。

#### 情境：查詢機台的告警
- **WHEN** 客戶端 GET `/machines/M-001/alerts`
- **THEN** 系統回傳 `M-001` 的所有告警，最新在前

#### 情境：以狀態篩選
- **WHEN** 客戶端 GET `/machines/M-001/alerts?status=ACTIVE`
- **THEN** 只回傳 `status: ACTIVE` 的告警

#### 情境：未知機台回傳 404
- **WHEN** 客戶端對不存在的 `machineId` GET `/machines/:id/alerts`
- **THEN** 系統回應 `404`、錯誤代碼 `MACHINE_NOT_FOUND`

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

### 需求：temperature 無效的 TEMPERATURE_REPORTED 不建立格式錯誤的告警
當 `TEMPERATURE_REPORTED` 事件的 `payload.temperature` 缺失或不是有限數值時，系統 SHALL NOT 建立告警。

#### 情境：缺 temperature 不建立告警
- **WHEN** Alert Service 消費的 `TEMPERATURE_REPORTED` 事件其 `payload.temperature` 缺失或不是有限數值
- **THEN** 不建立告警文件，且該事件被記錄為已跳過

### 需求：無法辨識的事件類型不建立告警
系統在消費 `eventType` 不屬於 5 種已知 MVP 事件類型的事件時 SHALL NOT 建立告警，且 SHALL 記錄該次跳過。

#### 情境：未知事件類型不產生告警
- **WHEN** Alert Service 消費的事件其 `eventType` 不符合 `STATUS_CHANGED`、`TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED` 任一
- **THEN** 不建立告警文件，且該事件被記錄為已跳過

### 需求：告警可跨機台查詢
系統 SHALL 曝露 `GET /alerts`，可選擇以 `status` 篩選並以 `limit` 限制（預設 20，伺服器設上限），跨所有機台回傳告警，最新在前，項目形狀與 `GET /machines/:id/alerts` 相同。

#### 情境：全廠的作用中告警
- **WHEN** 客戶端 GET `/alerts?status=ACTIVE`
- **THEN** 回傳所有機台的 ACTIVE 告警，最新在前，每筆帶有 `alertId`、`machineId`、`eventId`、`severity`、`status`、`message`、`createdAt`

#### 情境：limit 被套用且有上限
- **WHEN** 客戶端 GET `/alerts?limit=5`
- **THEN** 最多回傳 5 筆告警；請求超過伺服器上限的 limit 時最多回傳上限筆數

### 需求：status 篩選對照告警狀態值域驗證
系統 SHALL 拒絕不屬於告警狀態集合（`ACTIVE`、`RESOLVED`）的 `status` 查詢值（在 `GET /alerts` 與 `GET /machines/:id/alerts` 上），回應 `400`、錯誤代碼 `INVALID_QUERY_PARAMETER`，且成員資格驗證使用與 schema 相同的常數。

#### 情境：值域外的 status 被拒絕
- **WHEN** 客戶端 GET `/alerts?status=foo`（或 `?status=active`，大小寫錯誤）
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_QUERY_PARAMETER`，而不是無聲地回傳空清單
