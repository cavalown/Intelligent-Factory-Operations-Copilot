## 新增的需求

### 需求：不可變地持久化已消費的事件
系統 SHALL 從 `machine.events` Kafka topic 消費 `TEMPERATURE_REPORTED` 事件，並把每個事件持久化為 `machine_events` collection 中的不可變文件，完整保留事件信封不變。

#### 情境：消費時持久化事件
- **WHEN** Event Service 從 `machine.events` 消費一個 `TEMPERATURE_REPORTED` 事件
- **THEN** 它在 `machine_events` 儲存一份文件，包含所有信封欄位（`eventId`、`eventType`、`schemaVersion`、`source`、`machineId`、`occurredAt`、`producedAt`、`correlationId`、`payload`）且未經更改

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
