# 設計：dashboard-operational-metrics

## 脈絡

所有輸入都已存在於 `machine_events`（不可變歷史）與 `alerts`。machines 投影 consumer（`machine-projection-consumer.service.ts`）已依機台狀態規則從**多種**事件類型（STATUS_CHANGED、ERROR_OCCURRED、MAINTENANCE_REQUIRED、超過閾值的 TEMPERATURE_REPORTED）推導狀態變化。2026-07-11 的探索把稼働率與滾動 24 小時生產量識別為「純計算」波次：不需要新事件類型、不需要改 `machine_events` 綱要。

## 目標 / 非目標

**目標：**

- 滾動 24 小時視窗的分狀態時間（operating / stopped / idle），按機台與全工廠。
- 儀表板上的滾動 24 小時生產量。
- Dashboard 上可見的 Active Alerts；狀態磚下鑽到篩選後的機台列表。
- 所有投影可從 `machine_events` 重建（保留關鍵設計規則 1）。

**非目標：**

- 完整的 OEE（性能/品質兩腿需要良品/不良品數量與理想週期時間 — 後續波次）。
- 日曆日視窗與時區設定（滾動 24 小時繞開它；等真實工廠時區存在時再檢視）。
- 告警確認生命週期（Phase 2 承諾）、機台連結以外的告警觸發導覽。
- 歷史稼働率圖表（本變更計算一個視窗，不是時間序列）。

## 決策

### D1：在投影 consumer 記錄狀態轉移，不在查詢時重新推導

稼働率需要狀態**時間軸**，但投影狀態的變化由四種事件類型驅動、詮釋規則住在投影 consumer 裡。查詢時重新推導時間軸會重複那些規則（codebase 已因重複的詮釋邏輯出過一類 bug — 見感測器故障契約測試）。改為由 consumer 在改變機台狀態的那一刻向 `machine_status_transitions` 附加：

```
{ machineId, fromStatus, toStatus, at (event occurredAt), eventId }
unique index on eventId (idempotency, key design rule 4)
index { machineId: 1, at: -1 }
```

這是投影，不是新的真實：可以把 `machine_events` 重播過同一個 consumer 重建。曾考慮的替代方案 — 機台文件上的終身分狀態計數器：否決，無法回答視窗式查詢。

### D2：滾動 24 小時視窗，讀取時計算

`GET /machines/:id/utilization` 重建視窗：抓取 `[now-24h, now]` 內的轉移加上視窗起點前最新的一筆轉移（以得知視窗起點的狀態），然後做區間算術。桶：**operating** = RUNNING + WARNING（機台在生產、可能降級）、**stopped** = ERROR + MAINTENANCE、**idle** = IDLE。回報三個桶；UI 標為運轉/停機/閒置。在 3 台機台與 20 事件的 demo 節奏下查詢負載微不足道；300 台機台的部署會預先計算 rollup（記載、不建）。

**Bootstrap 近似：** 目前狀態早於任何已記錄轉移的機台（轉移只從本變更部署起開始累積）被視為從視窗起點就維持目前狀態。記載於端點說明；累積 24 小時轉移歷史後自然消失 — 事件重播重建後完全消失。

### D3：24 小時生產量併入 `/dashboard/stats`，稼働率也是

`GET /dashboard/stats` 回應新增一個加法性的 key：

```json
"last24h": {
  "productionCount": 42,
  "operatingMs": 61200000,
  "stoppedMs": 4300000,
  "idleMs": 20900000
}
```

生產量 = 對 `occurredAt >= now-24h` 的 `PRODUCTION_COMPLETED` 事件聚合（`payload.quantity` 總和）；時長 = 各機台稼働率的總和。加法性變更 — 既有消費者不受影響。

**套用時修正：** 原始計畫（「MachinesService 使用 EventsService 匯出的方法」）會造成模組循環 — `EventsModule` 已 import `MachinesModule`。因此 stats 路由移到一個新的薄 `dashboard/` 組合模組（`DashboardModule` → import `MachinesModule` + `EventsModule`；`DashboardService` 合併 `getDashboardStats()` + `sumProductionSince()` + `getFactoryUtilization()`）。這取代 add-frontend-mvp 設計 D4「stats 住在 machines 模組」— 該決策的前提（stats 只讀 machines 投影）在 24 小時生產量進入回應的那一刻就不再成立。純組合模組正是 architecture.md §7.7 描述的 API 層聚合角色；`machines/` 仍擁有 `GET /machines/:id/utilization`，因為它只讀機台擁有的資料。

### D4：`GET /alerts` 是既有內部讀取上的薄路由

`AlertsService.listAlerts({ status?, limit? })` 已存在（為 insights 而建）。新增 `AlertsListController`（`@Controller('alerts')`），以 `status` 與 `limit`（預設 20、有上限）查詢參數曝露它。回應形狀與 `GET /machines/:id/alerts` 相同。這刻意呼應 events 模組的按機台/跨機台路由對。

### D5：前端以 URL 狀態做下鑽

狀態磚導向 `/machines?status=WARNING` 等；機台列表讀查詢參數並在客戶端篩選（3 台機台 — 還不需要伺服器端篩選參數；URL 形狀是穩定介面）。Active Alerts 小工具列出最新的 ACTIVE 告警（嚴重度標籤、機台連結、訊息、相對時間），以 5 秒預設輪詢。機台詳情新增來自按機台端點的稼働率條（三個時長）。

## Code-review 修復（2026-07-11 新增，10 發現審查之後）

### D6：時間戳記在攝取層驗證 — 嚴格的標準形式

該審查把四個正確性發現追溯到一個根因：`occurredAt`/`producedAt` 進入系統時只有 null 檢查，而下游的一切（字典序視窗查詢、轉移排序、Date.parse 算術）都假設標準 ISO-8601 UTC（`YYYY-MM-DDTHH:mm:ss.sssZ`）。在源頭修：simulator 信封驗證要求標準 regex 加 `Number.isFinite(Date.parse(...))`，以既有的 `400 INVALID_EVENT_ENVELOPE` 拒絕 — 這強制執行 api.md §2.3 早已宣告的內容，不用新錯誤代碼。否決的替代方案：接受並正規化（無聲改寫 producer 的事實比拒絕它更令人意外）。

### D7：轉移寫入是 best-effort；主投影永遠獲勝

轉移是可重建的次要投影 — 它的寫入失敗絕不能中止 machines 投影更新（審查顯示那裡的 ValidationError 會被分類為 poison pill，提交 offset 並永久失去該事件的投影效果）。consumer 的轉移寫入現在吞掉**所有**錯誤（非 duplicate 的記為警告）並一律繼續到 `machine.save()`。失敗語意已驗證：資料錯誤 → 轉移被跳過 + 記錄、投影保留；暫時性 Mongo 錯誤 → 隨後的 `save()` 也失敗 → 重新拋出 → 重送時兩者都重試（duplicate-key 吞掉維持冪等）。讀取端的縱深防禦：`computeWindow` 跳過（並記錄）`at` 無法解析的轉移，並在記憶體中把解析後的時間戳記重新做數值排序，讓走訪永不依賴字典序。

### D8：查詢參數驗證獲得一個記載的錯誤代碼

`GET /alerts`（與按機台路由）的 `status` 對照 `ALERT_STATUSES` 驗證成員資格 — 放在 `AlertsService.listAlerts` 內，讓每條 HTTP 路徑都被涵蓋。新記載的代碼 `400 INVALID_QUERY_PARAMETER`（api.md §6）：既有代碼不改變用途就無法重用（`PAYLOAD_VALIDATION_FAILED` 是 simulator payload 專屬），而無聲忽略會把前端錯字藏成「沒有告警」。

### D9：bootstrap 近似被呈現，不是無聲

稼働率回應新增 `approximate: boolean` — 只在 `?? currentStatus` fallback（完全沒有轉移紀錄）時為 true，那正是被虛構的情況；有視窗前轉移的機台是真實資料。任一機台的視窗為近似時 `last24h.approximate` 為 true。前端在受影響的時長前加 `≈`。

### D10：現在的效率修復 vs. 之後的規模路徑

現在：只有在沒有視窗內轉移時才抓 `beforeWindow`（`inWindow[0].fromStatus` 已提供視窗起點狀態），且兩個轉移查詢都用 `.lean()` 加欄位投影 — 常見的按機台情況從 2 個查詢降到 1 個。之後（記載、不建）：把所有機台批次成一個視窗內 find + 一個分組的視窗前聚合（2N+1 → 3），加回應快取 — 300 台機台的路徑。狀態變更封裝（審查發現 8）同樣延後：`machine.status` 今天恰好只有一條寫入路徑；我們抽出具名的 `recordTransitionIfChanged` 並在 `machine-schema.md` 記錄契約（「任何未來變更狀態的路徑必須記錄轉移」），等 Phase 2 真的加了第二條路徑才重構為擁有的 `applyStatus`。

## 風險 / 取捨

- [轉移 collection 只從部署起累積] → bootstrap 近似（D2）在頭 24 小時略有誤差；事件重播重建（architecture.md §10.4）在重播工具落地時就能補完整歷史。
- [`occurredAt`（simulator 提供）與 `now` 之間的時鐘偏差] → 時長一致地使用事件 `occurredAt`；日期在過去/未來的 simulator 事件對視窗的偏差就像它對 MVP 裡其他一切的偏差 — 可接受。
- [重複/亂序事件] → `eventId` 唯一索引讓寫入冪等；按機台的 Kafka key 保序（規則 5），所以每台機台的轉移按序抵達。
- [每次輪詢重算滾動視窗（5 秒 × 開啟的頁面）] → 對至多數十筆轉移的區間算術；可忽略。等機台數量需要時才預先計算。

## 未決問題

1. 機台列表要不要也顯示每台機台的 24 小時稼働率欄位（不只詳情頁）？目前傾向不要 — 表格寬度；看過詳情條後再檢視。
2. Active Alerts 小工具需要「view all」目的地（未來的 Alerts 頁面）嗎？還是在 Phase 2 的 ACK 工作流程逼出真正的頁面之前，小工具本身就夠？（本變更只做小工具。）
