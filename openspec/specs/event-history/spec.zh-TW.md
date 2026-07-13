# event-history 規格

## 目的
TBD - 由歸檔變更 backend-walking-skeleton 建立。歸檔後更新 Purpose。
## 需求
### 需求：不可變地持久化已消費的事件
系統 SHALL 從 `machine.events` Kafka topic 消費任何 MVP 事件類型（`STATUS_CHANGED`、`TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED`）的事件，並把每個事件持久化為 `machine_events` collection 中的不可變文件，完整保留事件信封不變。

#### 情境：消費時持久化事件
- **WHEN** Event Service 從 `machine.events` 消費一個 `TEMPERATURE_REPORTED` 事件
- **THEN** 它在 `machine_events` 儲存一份文件，包含所有信封欄位（`eventId`、`eventType`、`schemaVersion`、`source`、`machineId`、`occurredAt`、`producedAt`、`correlationId`、`payload`）且未經更改

#### 情境：非溫度事件類型以相同方式持久化
- **WHEN** Event Service 從 `machine.events` 消費 `STATUS_CHANGED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED` 或 `PRODUCTION_COMPLETED` 事件
- **THEN** 它在 `machine_events` 儲存一份包含所有信封欄位且未經更改的文件，使用與 `TEMPERATURE_REPORTED` 相同的持久化邏輯

### 需求：對重複的 eventId 冪等
系統 SHALL NOT 為已儲存過的 `eventId` 建立重複的 `machine_events` 文件。

#### 情境：重複事件被忽略
- **WHEN** Event Service 消費的事件其 `eventId` 已存在於 `machine_events`
- **THEN** 它不插入第二份文件，也不讓 consumer 出錯

### 需求：事件歷史可按機台查詢
系統 SHALL 曝露 `GET /machines/:id/events`，以游標式分頁（`limit`、`before`）回傳該機台的事件，最新在前，依 `docs/design/api.md` §4.3。

#### 情境：查詢近期事件
- **WHEN** 客戶端不帶查詢參數 GET `/machines/M-001/events`
- **THEN** 系統回傳 `M-001` 最多預設 limit 筆的事件，最新在前，並帶分頁中繼資料（`nextCursor`、`hasMore`）

#### 情境：未知機台回傳 404
- **WHEN** 客戶端對不存在的 `machineId` GET `/machines/:id/events`
- **THEN** 系統回應 `404`、錯誤代碼 `MACHINE_NOT_FOUND`

### 需求：事件歷史可跨所有機台查詢
系統 SHALL 曝露 `GET /events`，以游標式分頁（`limit`、`before`）回傳跨所有機台的事件，最新在前，可選擇以 `machineId` 及／或 `eventType` 篩選，使用與 `GET /machines/:id/events` 相同的回應信封。

#### 情境：查詢跨所有機台的近期事件
- **WHEN** 客戶端不帶查詢參數 GET `/events`
- **THEN** 系統回傳跨所有機台最多預設 limit 筆的事件，最新在前，並帶分頁中繼資料（`nextCursor`、`hasMore`）

#### 情境：以 machineId 篩選
- **WHEN** 客戶端 GET `/events?machineId=M-001`
- **THEN** 系統只回傳 `M-001` 的事件，形狀與 `GET /machines/M-001/events` 相同

#### 情境：跨機台以 eventType 篩選
- **WHEN** 客戶端 GET `/events?eventType=ERROR_OCCURRED`
- **THEN** 系統只回傳跨所有機台的 `ERROR_OCCURRED` 事件，最新在前

#### 情境：未知的 machineId 篩選回傳 404
- **WHEN** 客戶端對不存在的 `machineId` GET `/events?machineId=M-999`
- **THEN** 系統回應 `404`、錯誤代碼 `MACHINE_NOT_FOUND`

### 需求：明確的 limit=0 被尊重，不無聲地套用預設值
系統 SHALL 把明確提供的 `limit=0` 視為 `0`（再截限到既有的最小值 `1`），而不是「未提供 limit」（否則會退回預設的 `20`），在 `GET /machines/:id/events` 與 `GET /events` 上皆然。

#### 情境：limit=0 被截限到最小值，而非套用預設
- **WHEN** 客戶端 GET `/events?limit=0` 或 `/machines/:id/events?limit=0`
- **THEN** 系統最多回傳 1 筆事件（截限後的最小值），而不是預設的 20 筆
