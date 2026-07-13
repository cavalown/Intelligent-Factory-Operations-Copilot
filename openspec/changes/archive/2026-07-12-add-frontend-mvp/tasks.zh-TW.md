# 任務：add-frontend-mvp

## 1. 後端：dashboard stats + CORS

- [x] 1.1 把 `MachinesService.getDashboardStats()` 實作為單一 aggregation pipeline（五種狀態零填滿的 `statusCounts`、`machineCount`、`totalProductionCount`、空 collection 時為 `null` 的 `averageHealthScore`）
- [x] 1.2 在 machines 模組新增 `DashboardController`（`@Controller('dashboard')`、`GET /dashboard/stats`）並註冊
- [x] 1.3 為 stats 聚合寫單元測試：混合狀態、空 collection、事件後的狀態變化（規格情境）
- [x] 1.4 在 `backend/src/main.ts` 啟用 CORS（全開，依 api.md §2.6 的無驗證 MVP）
- [x] 1.5 在 `docs/design/api.md` 記載 `GET /dashboard/stats`（§4 端點 + §5 資料模型）並加進 `ai/context/api-contract-summary.md`

## 2. 前端腳手架

- [x] 2.1 以 Vite（vue-ts 範本）搭建 `frontend/`、TypeScript strict；加入 vue-router、@tanstack/vue-query、naive-ui；QueryClient 接上預設 `refetchInterval: 5000`、router 接上五條路由
- [x] 2.2 建置 API 層：`api/client.ts`（基於 `VITE_API_BASE_URL` 的 fetch 包裝，把 `{error:{code,message}}` 解析為型別化 `ApiError`）、`api/types.ts`（帶 api.md § 參照註記的契約型別）、各資源模組（machines、events、summaries、simulator、stats）
- [x] 2.3 App shell：帶導覽（Dashboard、Machines、Event Center、Simulator）的版面、路由視圖、Naive UI provider（message/dialog/theme）
- [x] 2.4 加入 `frontend/Dockerfile`（Vite dev server、`--host`、:5173），取消註解/定案 `docker-compose.yml` 的 `frontend` 服務，記載於 `docs/deployment/docker-compose.md`

## 3. 頁面

- [x] 3.1 Dashboard：來自 `/dashboard/stats` 的統計磚（Critical = ERROR）、近期事件小工具、工廠 AI Summary Card（D6 狀態：已載入 / 空-產生 / 502-重試）
- [x] 3.2 機台列表：來自 `GET /machines` 的表格（名稱、狀態標籤、溫度、健康分數、最後更新），點列 → 詳情路由
- [x] 3.3 機台詳情：來自 `GET /machines/:id` 的 profile + 狀態 + 健康、近期事件（`GET /machines/:id/events`）、機台 AI Summary 卡片（同 D6 元件）、未知 id 的 not-found 狀態
- [x] 3.4 Event Center：來自 `GET /events` 的時間軸表格、只按 eventType 的顏色標籤（D7）、經 `before` 游標的「Load more」
- [x] 3.5 Simulator：機台選擇器（來自 `GET /machines`）、事件類型選單、由單一設定映射驅動的各類型 payload 欄位（D5）、信封組裝、送出後帶 202/錯誤回饋且保留表單狀態

## 4. 橫切行為

- [x] 4.1 共用 AI Summary 卡片元件：掛載時 GET（不輪詢）、帶載入狀態的 POST、成功時失效其查詢、404 → 產生 CTA、502 → 行內錯誤 + 重試
- [x] 4.2 每個頁面查詢的載入與錯誤狀態（Naive UI skeleton/Result）；確認輪詢在分頁隱藏時暫停（vue-query 預設）且摘要查詢永不輪詢

## 5. 驗證

- [x] 5.1 在瀏覽器對 Docker Compose 跑完整的 mvp.md demo 情境 — 2026-07-11 經 headless Chrome（Playwright）驗證：Dashboard 磚/事件/AI 卡片帶資料渲染、機台列表 → 詳情導覽、Event Center 時間軸只按 eventType 上色、Simulator 經 UI 表單發布 TEMPERATURE_REPORTED 事件（202 確認）、機台狀態/統計變化在一個輪詢內出現、未知機台 id 顯示 not-found 狀態；無非預期的 console 錯誤。執行期的 502 隔離點擊測試在 mock provider 下不可能（它不會失敗）— 由 AiSummaryCard 錯誤分支設計涵蓋，延到 insights 任務 2.2b 的真實 adapter
