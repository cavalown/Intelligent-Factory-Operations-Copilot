# machine-event-ingestion 規格（delta）

## 新增的需求

### 需求：事件時間戳記必須是標準 ISO-8601 UTC
系統 SHALL 拒絕 `occurredAt` 或 `producedAt` 不是標準 ISO-8601 UTC 字串（`YYYY-MM-DDTHH:mm:ss.sssZ`）或無法解析為有效時刻的 simulator 事件，回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE` — 強制執行 `docs/design/api.md` §2.3 宣告的時間戳記慣例。下游消費者（視窗查詢、轉移排序、時長算術）MAY 依賴已儲存時間戳記的字典序等於時間序。

#### 情境：偏移量形式的時間戳記被拒絕
- **WHEN** 客戶端以 `occurredAt: "2026-07-11T10:00:00+00:00"` POST `/simulator/events`
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE`，且沒有任何東西被發布到 Kafka

#### 情境：無法解析的時間戳記被拒絕
- **WHEN** 客戶端 POST 的事件其 `occurredAt` 形狀吻合但不是真實時刻（例如 `"2026-13-01T00:00:00.000Z"`）或為空字串
- **THEN** 系統回應 `400`、錯誤代碼 `INVALID_EVENT_ENVELOPE`

#### 情境：標準時間戳記被接受
- **WHEN** 客戶端 POST 的事件其 `occurredAt`/`producedAt` 為 `YYYY-MM-DDTHH:mm:ss.sssZ` 形式
- **THEN** 驗證通過，事件照常發布
