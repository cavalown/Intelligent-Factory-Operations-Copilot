## 新增的需求

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
