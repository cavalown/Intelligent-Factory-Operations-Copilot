# alert-detection 規格（delta）

## 新增的需求

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
