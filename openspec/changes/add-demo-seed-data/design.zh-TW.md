## 背景

機台目前由 backend 啟動時透過具冪等性的 `$setOnInsert` roster 建立。事件經由 `POST /api/simulator/events` 進入，再由三個獨立 Kafka consumer group 建立歷史、機台狀態與告警。直接插入 MongoDB 事件會讓這些衍生 view 不一致，而每次 backend 啟動時自動發布事件則會非預期地改變開發者資料。

## 目標／非目標

**目標：**

- 產生在視覺上有用的機台狀態、健康分數、溫度、生產數量、近期事件、告警與狀態轉換分布。
- 保留與實際 demo 操作者相同的 ingestion 與 projection 行為。
- 讓 event seed 保持明確觸發、無外部相依，並能在完整或部分執行過後安全重跑。

**非目標：**

- 隨機或持續產生事件。
- 重設現有資料，或把機台恢復為標準狀態。
- 新增 seed 專用 API endpoint，或直接寫入 MongoDB／Kafka。
- 精確模擬真實工廠的設備清單或 telemetry 分布。

## 決策

### D1：擴充既有啟動 roster

在目前三台機台的 `DEMO_MACHINES` array 加入五個 profile。保留 `$setOnInsert`，讓應用程式重啟時可加入缺少的 profile，但不覆寫事件衍生狀態。這沿用既有 ownership boundary；為固定 demo roster 另做機台匯入 script 會重複 registration 行為。

### D2：透過 Simulator API 發布精選事件

新增 `backend/scripts/seed-demo-events.mjs`，並以 `npm run seed:demo` 暴露。它使用 Node 內建 `fetch`，不需額外 runtime dependency，預設使用 `http://localhost:3000/api`，並可由環境變數覆寫。透過 HTTP 可驗證 envelope 與 machine ID、發布至 Kafka，並讓每個 consumer 建立自己的投影。

否決直接插入 collection，因為那會重複 Machine 與 Alert Service 的 business rule，且需手動維護 `machine_status_transitions`。否決直接發布 Kafka，因為那會繞過公開 ingestion validation，且 host script 需要 Kafka client 設定。

### D3：使用固定 event ID 與 history-based skipping

每個精選事件都有固定 `eventId`。發布前，script 分頁讀取 `GET /events` 並收集既有 ID，再依時間順序只發布缺少的事件。檢查每個 ID 而非單一完成 marker，可讓中斷的執行復原，且不重播較早的 projection effect。

### D4：依執行時間產生 timestamp

Script 執行時，在最近 24 小時內指派依序排列的 timestamp。固定 ID 提供去重，近期 timestamp 則讓資料庫重設後的 rolling dashboard 生產與稼動率指標有資料。已存在的固定事件會被跳過，因此保留原先儲存的 timestamp。

### D5：使用精選狀態而非隨機化

Dataset 涵蓋五種 MVP event type，並刻意讓機台分布在 `RUNNING`、`IDLE`、`WARNING`、`ERROR` 與 `MAINTENANCE`。固定 payload 讓 screenshot 與 demo 容易理解，測試也具決定性；隨機資料可能產生空白告警畫面或失衡的狀態分布。

## 風險／取捨

- **[風險] Kafka consumers 為非同步，因此指令結束時 Dashboard 可能不會立即更新。** → 顯示完成訊息，說明 consumers 可能需要幾秒鐘。
- **[風險] 執行中的容器需要重建 backend，新增的機台 profile 才會存在。** → 發布前驗證 roster；缺少機台時顯示清楚的 rebuild 指令。
- **[風險] 固定 ID 代表在既有資料庫中重跑不會刷新 timestamp。** → 這是刻意的冪等性；重設 volumes 才是建立全新 demo timeline 的明確方式。
- **[取捨] Host-side script 假設 backend 可透過 HTTP 存取。** → 預設 Compose port mapping 已符合，API base override 可支援其他本機配置。

## 遷移計畫

1. 重建／重啟 backend，使其啟動 seed 加入新的機台 profile。
2. API 就緒後，在 `backend/` 執行 `npm run seed:demo`。
3. 回滾方式為還原 roster／script 變更。既有已 seed 的 MongoDB document 不會自動刪除；移除資料仍是操作者的明確動作。
