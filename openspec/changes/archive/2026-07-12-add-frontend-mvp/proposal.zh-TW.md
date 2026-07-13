# 提案：add-frontend-mvp

## 為什麼

後端 MVP 功能已完成（機台、事件、告警、simulator 攝取、兩種範圍的 AI 摘要 — 全部對照 `docs/design/api.md` 驗證過），但沒有任何東西把它渲染出來：`frontend/` 不存在，而 MVP 的完成定義要求 Dashboard、機台列表、機台詳情、Event Center 與 Simulator UI（`docs/product/mvp.md`）。本變更建置 Vue 3 儀表板，讓完整的 demo 情境能在瀏覽器中端到端跑完。

## 改什麼

- 建立 `frontend/` — 以 Vite 建置的 Vue 3 + TypeScript（strict）應用，用 Naive UI 造型，使用 Vue Router 與 TanStack Query（vue-query）做資料抓取、5 秒輪詢（WebSocket 不在 MVP 範圍；輪詢就能交付 demo 的「送事件 → 看狀態變化」循環）。
- 實作五個 MVP 視圖：Dashboard（工廠統計、近期事件、AI Summary Card）、機台列表、機台詳情（資訊、狀態、健康、近期事件、可手動重新產生的 AI 摘要）、Event Center（跨機台時間軸，只按 `eventType` 上色 — 沒有 severity 欄，依 `docs/product/mvp.md`）、Simulator（組出完整事件信封並 POST 的表單）。
- 新增一個後端端點：`GET /dashboard/stats`（各狀態機台數、生產總量、平均健康分數），讓 Dashboard 讀單一聚合而不是客戶端聚合 — 2026-07-10 決定，讓介面現在就長成 300 台機台的形狀。
- 在後端啟用 CORS（:5173 的 Vite dev server 呼叫 :3000 的 API）。
- UI 把 AI 摘要視為輔助功能：`502 LLM_CALL_FAILED` 只在摘要卡片顯示行內錯誤；機台/事件資料繼續渲染（`architecture.md` §16）。
- 把 `frontend` 接進 `docker-compose.yml`（目前是被註解掉的占位）並帶 `VITE_API_BASE_URL`。
- 以新的 stats 端點更新 `docs/design/api.md` 與 `ai/context/api-contract-summary.md`。

## 能力

### 新能力

- `dashboard-stats`：後端聚合讀取 — 從 machines 投影提供各狀態機台數、生產總量與平均健康分數。
- `operator-ui`：五頁的操作員儀表板 — 頁面內容、輪詢行為、AI 失敗隔離、只按事件類型上色，以及 simulator 事件組裝。

### 修改的能力

無 — 既有後端能力原樣被消費（`ai-summary`、`machine-state-projection`、`event-history`、`alert-detection` 的需求不變）。

## 影響

- **程式碼**：新的 `frontend/**`（Vite 應用）；後端 `machines` 模組新增 stats 查詢 + `dashboard` controller 路由；`backend/src/main.ts` 新增 `enableCors`。
- **API**：一條新路由 `GET /dashboard/stats`；既有路由不變。
- **文件**：`docs/design/api.md`（新的 §4 端點章節）、`ai/context/api-contract-summary.md`、`docs/deployment/docker-compose.md`（frontend 服務轉為真實）。
- **基礎設施**：`docker-compose.yml` 的 frontend 服務取消註解；新的 `frontend/Dockerfile`。
- **依賴**：前端套件樹（vue、vue-router、@tanstack/vue-query、naive-ui、vite、typescript）；後端無新依賴。
- **順序**：依賴已完成的 `add-insights-module` 實作（其後續任務 2.2b 仍在進行中 — mock LLM provider 已足以支撐所有前端工作）。
