# 任務：dashboard-operational-metrics

## 1. 轉移投影

- [x] 1.1 建立 `machine-status-transition.schema.ts`（`machine_status_transitions`）：machineId、fromStatus、toStatus、at、eventId；eventId 唯一索引、索引 `{ machineId: 1, at: -1 }`（狀態 enum 依 Mongoose 聯集型別陷阱使用明確的 `type: String`）
- [x] 1.2 在 machines 投影 consumer 改變投影狀態的每處（四種驅動事件類型）附加轉移紀錄；狀態不變時跳過；eventId 的 duplicate-key 吞掉（冪等性，重用 `isDuplicateKeyError`）
- [x] 1.3 單元測試轉移記錄：變化以事件的 occurredAt 記錄、狀態不變時不記錄、重複 eventId 被忽略

## 2. 稼働率計算 + 端點

- [x] 2.1 在 machines 模組實作滾動 24 小時的區間算術：抓取視窗內轉移 + 視窗前最新轉移，分桶為 operatingMs（RUNNING+WARNING）/ stoppedMs（ERROR+MAINTENANCE）/ idleMs（IDLE），含 D2 的 bootstrap 近似（無轉移時目前狀態跨越視窗）
- [x] 2.2 曝露 `GET /machines/:id/utilization`（未知 id 為 404 MACHINE_NOT_FOUND）
- [x] 2.3 為 24 小時生產量總和新增匯出的 `EventsService` 聚合（`PRODUCTION_COMPLETED`、occurredAt 視窗、payload.quantity 總和）— machines 模組依模組邊界規則使用它
- [x] 2.4 以 `last24h` 擴充 `getDashboardStats()`（productionCount + 加總的稼働率桶；空工廠為零）
- [x] 2.5 單元測試：時間軸切分加總等於視窗長度、無轉移的 fallback、空工廠的零、生產視窗總和排除超過 24 小時的事件

## 3. 跨機台告警端點

- [x] 3.1 新增 `AlertsListController`（`@Controller('alerts')`、GET 帶 `status`/`limit`、預設 20 且伺服器設上限），委派給既有的 `AlertsService.listAlerts`
- [x] 3.2 單元測試：status 篩選直通、預設/截限的 limit

## 4. 前端

- [x] 4.1 API 層：加入 `getUtilization(machineId)`、`listAlerts({status, limit})`、以 `last24h` 擴充 `DashboardStats` 型別；加入人類可讀的時長格式化器
- [x] 4.2 Dashboard：Active Alerts 小工具（嚴重度標籤、機台連結、訊息、相對時間；輪詢）；24 小時生產 + operating/stopped/idle 磚/條
- [x] 4.3 Dashboard：讓 Running/Warning/Critical 磚導向 `/machines?status=...`
- [x] 4.4 機台列表：從 URL 讀 `?status=`、客戶端篩選、顯示可清除的篩選指示
- [x] 4.5 機台詳情：來自 `GET /machines/:id/utilization` 的 24 小時稼働率條

## 5. 文件

- [x] 5.1 api.md：記載 `GET /machines/:id/utilization`、`GET /alerts` 與擴充的 `/dashboard/stats` 回應（含 D2 的 bootstrap 近似註記）
- [x] 5.2 以兩條新路由更新 `ai/context/api-contract-summary.md`

## 6. 驗證

- [x] 6.1 Docker Compose demo（2026-07-11 經 API 驅動 + headless Chrome 驗證）：送出改變狀態的事件序列（RUNNING → ERROR → RUNNING）、確認轉移被記錄、稼働率時長在機台詳情與 Dashboard 相應變動、PRODUCTION_COMPLETED 後 24 小時生產量遞增、新的 CRITICAL 告警在一個輪詢內出現在 Dashboard 小工具、Warning 磚下鑽到篩選後的機台列表

## 7. Code-review 修復（2026-07-11 審查，設計 D6–D10）

- [x] 7.1 Simulator 信封驗證：`occurredAt`/`producedAt` 必須符合標準 `YYYY-MM-DDTHH:mm:ss.sssZ` 且 `Number.isFinite(Date.parse(...))`；以既有的 `400 INVALID_EVENT_ENVELOPE` 拒絕；為偏移量形式、無法解析、空字串與標準形式寫單元測試
- [x] 7.2 Consumer：轉移寫入變 best-effort — 吞掉所有錯誤（非 duplicate 記為警告）、一律繼續到 `machine.save()`；抽出 `recordTransitionIfChanged` 私有方法；更新受影響的單元測試（非 dup 錯誤不再重新拋出）
- [x] 7.3 `computeWindow` 強化：跳過+記錄 `at` 無法解析的轉移；在記憶體中對解析後的時間戳記做數值重排序；只有 `inWindow` 為空時才抓 `beforeWindow`；兩個查詢加 `.lean()` + 欄位投影；更新單元測試
- [x] 7.4 `sumProductionSince` → 有界視窗：加 `$lte` 上界（簽名接收 since+until）；更新 DashboardService 與測試
- [x] 7.5 `approximate` 旗標：按機台稼働率回應 + `last24h.approximate`；前端在近似時長前渲染 `≈` 前綴；更新型別 + api.md §4.11/§4.12
- [x] 7.6 告警 status 驗證：在 `AlertsService.listAlerts` 對照 `ALERT_STATUSES` 做成員資格檢查，拋出新的 `400 INVALID_QUERY_PARAMETER`；在 api.md §6 記載該代碼；單元測試（無效、大小寫錯誤、有效）
- [x] 7.7 format.ts：`formatDuration(0)` → `'0m'`（與 `<1m` 區分）、NaN → `'—'`；`formatRelativeTime` 的 NaN 防護 → `'—'`
- [x] 7.8 文件：把 `machine_status_transitions` 加進 `ai/context/mongodb-collections.md`；把 `dashboard/` 作為 §7.7 API 層組合模組加進 architecture.md §14.1 與 module-boundaries.md；在 `docs/design/machine-schema.md` 加入狀態寫入契約註記
- [x] 7.9 完整回歸：後端測試、前端 build、Docker demo 重新驗證（拒絕壞時間戳記事件 → 400；稼働率/統計仍正確；`?status=foo` → 400）— 2026-07-11 驗證：55/55 測試、偏移量形式時間戳記 → 400 INVALID_EVENT_ENVELOPE、標準形式 → 202、status foo/小寫 → 400 INVALID_QUERY_PARAMETER、桶加總等於 windowMs、有歷史的機台 approximate:false 而工廠 approximate:true（bootstrap 機台）、儀表板磚上渲染「≈」
