## 新增的需求

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
