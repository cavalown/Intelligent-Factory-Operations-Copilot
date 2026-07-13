# 提案：dashboard-operational-metrics

## 為什麼

Dashboard 目前顯示的是靜態聚合（狀態數量、累計生產、平均健康），在 3 台機台的規模下缺乏營運意義 — 2026-07-11 的探索結論是它讀起來像「事件檢視器，不是監控頁面」。修好它所需的資料**早已記錄**（完整的 `STATUS_CHANGED`/`PRODUCTION_COMPLETED`/告警歷史）；缺的是按時間視窗的計算與可行動的呈現面。本變更加入稼働率（運轉/停機時間）、滾動 24 小時生產量、Active Alerts 小工具與磚下鑽 — 不需要新事件類型、不需要對 `machine_events` 做綱要擴充的最高價值切片。

## 改什麼

- **記錄機台狀態轉移**：machines 投影 consumer 在機台的投影狀態改變時，向新的 `machine_status_transitions` collection 附加一筆 `(machineId, fromStatus, toStatus, at, eventId)` 紀錄 — 一個可重建的投影、對 `eventId` 冪等，讓分狀態時間的算術成為可能。
- 滾動 24 小時視窗的**稼働率計算**：運轉時間（`RUNNING` + `WARNING`）、停機時間（`ERROR` + `MAINTENANCE`）、閒置時間（`IDLE`），按機台（`GET /machines/:id/utilization`）與全工廠（併入 `GET /dashboard/stats`）。
- **滾動 24 小時生產量**（視窗內 `PRODUCTION_COMPLETED` 數量的總和）加入 `GET /dashboard/stats`。
- **跨機台告警端點**：把既有的內部 `AlertsService.listAlerts` 以 HTTP 曝露為 `GET /alerts?status=&limit=` — Dashboard 的 Active Alerts 小工具讀它。
- **前端**：Dashboard 獲得 Active Alerts 小工具與 24 小時生產/稼働率磚；狀態磚變成可點擊，導向按狀態篩選的機台列表（新的 `?status=` 篩選）；機台詳情顯示該機台的 24 小時稼働率。
- 文件：`docs/design/api.md` 與 `ai/context/api-contract-summary.md` 加入新的/擴充的端點。

明確不在範圍內（依探索記錄供後續波次）：良品/不良品生產拆分、電力/電流感測事件、錯誤代碼註冊表、告警確認生命週期（Phase 2）、錯誤復原追蹤、時區感知的「日曆日」視窗（滾動 24 小時避開時區問題）。

## 能力

### 新能力

- `machine-utilization`：狀態轉移投影與滾動 24 小時分狀態時間計算，按機台與全工廠提供。

### 修改的能力

- `dashboard-stats`：回應新增 `last24h` 聚合（生產量、operating/stopped/idle 時長）。（Delta 增加需求；既有統計需求不變。）
- `alert-detection`：告警變成可跨機台查詢（`GET /alerts`），不只按機台。
- `operator-ui`：Dashboard 的 Active Alerts 小工具、可點擊的狀態磚 → 篩選後的機台列表、Dashboard 與機台詳情的稼働率顯示。

## 影響

- **程式碼**：後端 `machines` 模組（投影 consumer 的轉移記錄、稼働率 service + 端點、擴充的 stats）、`alerts` 模組（跨機台讀取的 HTTP 路由）；前端 Dashboard/MachineList/MachineDetail 頁面與 API 層。
- **API**：新的 `GET /machines/:id/utilization`、新的 `GET /alerts`、擴充的 `GET /dashboard/stats` 回應（加法性）。
- **資料庫**：新的 `machine_status_transitions` collection（投影 — 可從 `machine_events` 重建）。
- **文件**：api.md、api-contract-summary.md。
- **依賴**：無新增。
- **順序**：建立在 `add-frontend-mvp` 之上（仍作用中/未歸檔）；其 `dashboard-stats`/`operator-ui` delta 規格在此經新增需求延伸，所以歸檔順序不構成阻塞。
