# operator-ui 規格（delta）

## 新增的需求

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
