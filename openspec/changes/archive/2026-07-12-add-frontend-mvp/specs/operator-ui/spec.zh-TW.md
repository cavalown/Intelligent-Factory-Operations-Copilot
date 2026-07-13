# operator-ui 規格（delta）

## 新增的需求

### 需求：Dashboard 顯示工廠總覽
Dashboard 頁面 SHALL 顯示來自 `GET /dashboard/stats` 的工廠統計（running/warning/critical 數量、生產數量、平均健康分數）、來自 `GET /events` 的近期事件小工具，以及來自 `GET /summary` 的工廠範圍 AI Summary Card，依 `docs/product/mvp.md`。

#### 情境：Dashboard 渲染工廠狀態
- **WHEN** 操作員在有機台與事件的情況下打開 Dashboard
- **THEN** 統計磚顯示由 `statusCounts` 推導的數量（Critical = `ERROR`）、生產數量與平均健康分數，且近期事件小工具列出最新的跨機台事件

#### 情境：統計在一個輪詢週期內反映變化
- **WHEN** Dashboard 開啟時，一個模擬事件改變某機台的狀態
- **THEN** 統計磚與近期事件在一個 5 秒輪詢間隔內更新，不需手動重新載入

### 需求：機台列表顯示所有機台
機台列表頁 SHALL 顯示 `GET /machines` 的每台機台，含名稱、狀態、目前溫度、健康分數與最後更新時間，且選取時 SHALL 導向該機台的詳情頁。

#### 情境：列表渲染機台列
- **WHEN** 操作員打開機台列表
- **THEN** 每台機台顯示名稱、狀態、目前溫度、健康分數與最後更新時間，點擊一列打開該 `machineId` 的機台詳情

### 需求：機台詳情顯示單一機台的營運全貌
機台詳情頁 SHALL 顯示來自 `GET /machines/:id` 的機台資訊與目前狀態、來自 `GET /machines/:id/events` 的近期事件，以及來自 `GET /machines/:id/summary` 的 AI 摘要。

#### 情境：詳情渲染機台狀態與歷史
- **WHEN** 操作員為既有機台打開機台詳情
- **THEN** 頁面顯示機台的 profile、狀態、健康分數，以及最新在前的近期事件

#### 情境：未知的機台 id
- **WHEN** 操作員導航到不存在機台的詳情 URL
- **THEN** 頁面顯示 not-found 狀態（不是空白頁、沒有未處理的錯誤）

### 需求：AI 摘要是輔助性、明確觸發的功能
摘要卡片（Dashboard：工廠範圍；機台詳情：機台範圍）SHALL 渲染已存的摘要及其 `recommendedActions` 與重新產生動作；尚無摘要時（`404 SUMMARY_NOT_FOUND`）SHALL 顯示產生摘要的行動呼籲；`502 LLM_CALL_FAILED` 時 SHALL 顯示帶重試的行內錯誤，頁面其餘部分繼續渲染，依 `architecture.md` §16。

#### 情境：首次產生
- **WHEN** 尚無摘要且操作員點擊產生動作
- **THEN** 卡片在同步 `POST` 期間顯示載入狀態，然後渲染新摘要與建議行動

#### 情境：LLM 失敗被侷限
- **WHEN** 摘要 `POST` 回傳 `502 LLM_CALL_FAILED`
- **THEN** 只有摘要卡片顯示帶重試動作的錯誤狀態；頁面其他位置的機台、事件與統計內容維持可見並持續輪詢

### 需求：Event Center 顯示不帶 severity 的跨機台時間軸
Event Center 頁面 SHALL 以最新在前列出 `GET /events` 的事件，含機台、事件類型與時間戳記；SHALL 只按 `eventType` 為列上色（永不使用衍生的 severity）；且 SHALL 使用 API 的 `before` 游標往歷史回翻頁。

#### 情境：時間軸渲染並按事件類型上色
- **WHEN** 操作員打開 Event Center
- **THEN** 事件最新在前地出現，顯示機台、事件類型與時間戳記，列的強調色只由 `eventType` 推導

#### 情境：載入更多往回翻頁
- **WHEN** 操作員啟動「Load more」且 `pagination.hasMore` 為 true
- **THEN** 下一頁較舊的事件（以 `before` = 最後一筆事件的 id 取得）被附加到時間軸

### 需求：Simulator 頁面發布格式完好的事件
Simulator 頁面 SHALL 讓操作員選擇機台與五種 MVP 事件類型之一、填寫該類型的 payload 欄位，並 POST 一個完整信封（客戶端產生的 `eventId`、`occurredAt`、`producedAt`、`correlationId`、`schemaVersion`、`source: "MACHINE_SIMULATOR"`）到 `/simulator/events`，並呈現接受/拒絕的結果。

#### 情境：送出溫度事件
- **WHEN** 操作員選擇機台、選 `TEMPERATURE_REPORTED`、輸入溫度並送出
- **THEN** 頁面 POST 一個完整信封，並顯示 `202 PUBLISHED` 確認與 `eventId`

#### 情境：驗證錯誤被呈現
- **WHEN** 後端拒絕該事件（`400`/`404`/`422`）
- **THEN** 頁面顯示錯誤信封的代碼與訊息，且不丟失表單狀態

### 需求：即時資料每 5 秒輪詢
機台、事件與統計查詢在其頁面可見時 SHALL 以 5 秒間隔輪詢；AI 摘要查詢 SHALL NOT 輪詢，SHALL 只在隨需或成功重新產生後重新取得。

#### 情境：demo 循環不需手動重新整理
- **WHEN** 操作員送出 simulator 事件並切換到 Dashboard 或機台列表
- **THEN** 受影響機台的狀態變化在一個輪詢間隔內出現，不需要任何手動重新整理
