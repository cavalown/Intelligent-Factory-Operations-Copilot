## 新增的需求

### 需求：明確的 limit=0 被尊重，不無聲地套用預設值
系統 SHALL 把明確提供的 `limit=0` 視為 `0`（再截限到既有的最小值 `1`），而不是「未提供 limit」（否則會退回預設的 `20`），在 `GET /machines/:id/events` 與 `GET /events` 上皆然。

#### 情境：limit=0 被截限到最小值，而非套用預設
- **WHEN** 客戶端 GET `/events?limit=0` 或 `/machines/:id/events?limit=0`
- **THEN** 系統最多回傳 1 筆事件（截限後的最小值），而不是預設的 20 筆
