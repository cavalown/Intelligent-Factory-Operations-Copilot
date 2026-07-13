# operator-ui 規格

## 目的
依 `docs/product/mvp.md` 的五頁 Vue 3 操作員儀表板（Dashboard、機台列表、機台詳情、Event Center、Simulator）：各頁面內容、以 5 秒輪詢作為 MVP 的即時機制、AI 摘要的輔助性隔離（502 永不讓頁面空白）、只按事件類型上色（無衍生 severity），以及客戶端組裝 simulator 信封。由變更 `add-frontend-mvp`（2026-07-11）引入。

## 需求

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

### 需求：Dashboard 顯示作用中告警
Dashboard SHALL 顯示由 `GET /alerts?status=ACTIVE` 餵資料的 Active Alerts 小工具（以標準間隔輪詢），每一項顯示嚴重度、機台（連到其詳情頁）、訊息與時間。

#### 情境：嚴重事件後告警出現
- **WHEN** Dashboard 開啟時處理了一個 `ERROR_OCCURRED` 事件
- **THEN** 新的 CRITICAL 告警在一個輪詢間隔內出現在小工具中，並連到受影響的機台

### 需求：狀態磚下鑽到篩選後的機台列表
Dashboard 的狀態磚（Running / Warning / Critical）點擊時 SHALL 透過 URL 狀態（`/machines?status=...`）導向篩選到對應狀態的機台列表，且機台列表 SHALL 套用並顯示該篩選。

#### 情境：點擊 Warning 磚
- **WHEN** 操作員點擊「Warning」磚
- **THEN** 機台列表打開且只顯示狀態為 `WARNING` 的機台，作用中的篩選可見且可清除

### 需求：稼働率在 Dashboard 與機台詳情可見
Dashboard SHALL 顯示來自 `dashboard-stats.last24h` 的工廠滾動 24 小時生產數量與 operating/stopped/idle 時長；機台詳情 SHALL 顯示來自 `GET /machines/:id/utilization` 的該機台 24 小時稼働率。時長 SHALL 以人類可讀方式渲染（例如「6h 24m」，而非毫秒）。

#### 情境：Dashboard 顯示 24 小時全貌
- **WHEN** 操作員打開 Dashboard
- **THEN** 磚/條顯示過去 24 小時的生產數量與三個時長桶，皆為人類可讀形式

#### 情境：機台詳情顯示自己的稼働率
- **WHEN** 操作員為有轉移紀錄的機台打開機台詳情
- **THEN** 頁面顯示該機台過去 24 小時的 operating/stopped/idle 時長

### 需求：UI 在手機與平板寬度可用，且桌面不退步
全部五個頁面在手機（<640px）與平板（640–1024px）寬度 SHALL 可用 — 無整頁水平捲動、無重疊或被裁切的內容、互動目標足以觸控 — 同時桌面（≥1024px）版面維持現狀。斷點遵循 Naive UI 的系統（640/1024）；依 `ai/rules/frontend-responsive.md`，未來每個前端變更都要說明其窄寬度行為。

#### 情境：頁面在手機上於視口內渲染
- **WHEN** 五個頁面任一在 390px 寬的視口開啟
- **THEN** 頁面渲染時 body 無水平捲動，所有內容區塊都能透過垂直捲動抵達

#### 情境：桌面不變
- **WHEN** 頁面在 ≥1024px 開啟
- **THEN** 既有的頂部選單版面、並排列與完整表格照本變更之前的樣子渲染

### 需求：手機透過底部分頁列導覽
在手機寬度，應用程式 SHALL 呈現固定的底部分頁列，含四個目的地（Dashboard、Machines、Event Center、Simulator），取代頂部選單；內容 SHALL NOT 被它遮住。

#### 情境：分頁列取代頂部選單
- **WHEN** 應用程式在手機寬度檢視
- **THEN** 底部分頁列可見且作用中的目的地被突顯、頂部水平選單不存在、點擊分頁導向該頁面

### 需求：機台列表在手機上變成卡片清單
在手機寬度，機台列表 SHALL 把每台機台渲染為可點擊的卡片（狀態標籤與名稱醒目；溫度、健康分數與最後更新可見）而非表格，並保留 `?status=` 下鑽篩選與導向機台詳情。

#### 情境：手機用卡片，其他用表格
- **WHEN** 機台列表在手機寬度以 `?status=WARNING` 篩選開啟
- **THEN** 只有 WARNING 機台以卡片出現，帶可清除的篩選指示，點卡片打開該機台的詳情頁；平板/桌面寬度使用表格渲染

### 需求：事件表格在窄寬度自適應
事件表格（Event Center、Dashboard 近期事件、機台詳情事件）在手機寬度 SHALL 移除 payload 欄，若仍太寬則在自己的容器內水平捲動 — 永不強迫整頁水平捲動。

#### 情境：手機上精簡的事件表格
- **WHEN** Event Center 在手機寬度開啟
- **THEN** 時間、機台與事件類型維持可見（payload 欄不存在）、依 eventType 的上色保留、任何溢出只在表格容器內捲動

### 需求：並排版面在窄寬度堆疊
Dashboard 的事件/告警/摘要列與機台詳情的事件/摘要列在平板斷點以下 SHALL 垂直堆疊，每個區塊佔滿寬度；機台詳情的描述格線在窄寬度 SHALL 減少欄數。

#### 情境：Dashboard 在平板直向堆疊
- **WHEN** Dashboard 在 768px 寬的視口開啟
- **THEN** Recent Events、Active Alerts 與 AI Summary 卡片以該閱讀順序堆疊為全寬呈現，皆未被裁切
