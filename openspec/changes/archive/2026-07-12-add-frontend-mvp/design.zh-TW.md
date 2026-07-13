# 設計：add-frontend-mvp

## 脈絡

五個 MVP 頁面需要的每個 API 都已存在且符合 `docs/design/api.md`（基底 URL `http://localhost:3000/api` — 全域前綴在 add-insights-module 的審查回合修正）。mock LLM provider 意味著 AI Summary 卡片不需任何 API key 就能端到端運作。技術棧決策於 2026-07-10 鎖定：Naive UI、TanStack Query 加 5 秒輪詢、後端提供 dashboard stats、Simulator 作為一級頁面。

規模哲學：今天 3 台機台、300 台機台的願景 — 介面切在業界版本會切的地方（後端的聚合統計端點、型別化的 API client 邊界），實作維持 MVP 薄度（客戶端狀態不存在就不引入狀態函式庫、不做 codegen、不做圖表）。

## 目標 / 非目標

**目標：**

- 五個 MVP 頁面依 `docs/product/mvp.md` 全部可用，demo 情境能在瀏覽器從頭到尾跑完。
- 機台/事件/告警衍生資料 5 秒輪詢；AI 摘要隨需抓取、經明確的使用者動作重新產生。
- `GET /dashboard/stats` 後端聚合：各機台狀態數量、生產總量、平均健康分數。
- UI 的 AI 失敗隔離：摘要卡片錯誤永不讓頁面其餘部分空白。
- 前端與後端一起跑在 Docker Compose。

**非目標：**

- WebSocket/即時推送、身分驗證、告警管理 UI（alerts API 存在但沒有 MVP 頁面列告警）、圖表、i18n、響應式/行動版面、E2E 測試自動化（依 `ai/rules/testing.md` 過渡政策以手動 demo 驗證）。
- 型別的 OpenAPI codegen（等後端有 spec 產生再考慮；手抄型別是 MVP 的取捨）。

## 決策

### D1：技術棧 — Vite + Vue 3 + TS strict + Vue Router + vue-query + Naive UI；不用 Pinia

伺服器狀態（機台、事件、統計、摘要）完全住在 TanStack Query 的快取裡；MVP 沒有剩下的客戶端全域狀態，所以 Pinia 會空無一物。等真實的客戶端狀態出現再加。Naive UI 提供儀表板詞彙（Card、DataTable、Tag、Statistic、Result），完整 TypeScript 支援與 tree-shaking。

曾考慮的替代方案：Pinia 優先加手寫 fetch composable — 否決：vue-query 的 `refetchInterval`、快取失效與載入/錯誤狀態，恰好取代我們原本要手寫的那些程式碼。

### D2：輪詢而非推送 — `refetchInterval: 5000`

機台列表、機台詳情、事件與 dashboard stats 查詢每 5 秒輪詢（一個 `QueryClient` 預設值，個別查詢可退出）。AI 摘要查詢不輪詢 — 掛載時抓取，並在成功的 `POST .../summary` 後失效。demo 送出事件後最壞的等待是一個輪詢週期。WebSocket 仍是 Phase 2 路線圖項目；查詢 key 結構（`['machines']`、`['machine', id]`、`['events', filters]`）就是之後推送失效可以接上的接縫。

### D3：型別化 API client — 薄的 fetch 包裝 + 手抄契約型別

`frontend/src/api/` 包含：`client.ts`（讀 `VITE_API_BASE_URL` 的 fetch 包裝，把 `{ error: { code, message } }` 信封解析為型別化的 `ApiError`）、`types.ts`（從 `docs/design/api.md` §5 手抄的請求/回應形狀，每個都註記其 api.md 章節），以及每個資源一個模組（`machines.ts`、`events.ts`、`summaries.ts`、`simulator.ts`、`stats.ts`）。7 個端點不做 codegen；註記紀律讓漂移可以被找到。

### D4：`GET /dashboard/stats` 住在 machines 模組

這個聚合只讀 `machines` 投影（狀態數量、`productionCount` 總和、`healthScore` 平均），而模組邊界規則說資料的擁有者提供它。實作為 `MachinesService.getDashboardStats()` 的單一 MongoDB aggregation pipeline，由 `machines/` 內新的 `DashboardController`（`@Controller('dashboard')`）曝露。回應形狀：

```json
{
  "machineCount": 3,
  "statusCounts": { "RUNNING": 1, "IDLE": 0, "WARNING": 1, "ERROR": 0, "MAINTENANCE": 1 },
  "totalProductionCount": 145,
  "averageHealthScore": 62.7
}
```

五種狀態一律存在（以零填滿），讓前端永遠不用對缺失的 key 做分支。mvp.md 的「Critical Machines」磚對應 `statusCounts.ERROR`。曾考慮的替代方案：獨立的 `dashboard/` 模組 — 否決：它不會擁有任何資料，存在只為了 import MachinesService。

### D5：Simulator 頁面在客戶端組出完整信封

依 api.md §4.8，simulator 擁有信封組裝：頁面產生 `eventId`（`evt_` + `crypto.randomUUID()`）、`occurredAt`/`producedAt`（現在時刻，ISO）、`correlationId`、`schemaVersion: 1`、`source: "MACHINE_SIMULATOR"`，並由單一設定映射驅動渲染各事件類型的 payload 欄位（temperature/unit、errorCode/recoverable、currentStatus/reason……）— 之後新增事件類型只需一筆設定，不是一張新表單。

### D6：AI 摘要 UX — 輔助性、明確觸發、隔離

摘要卡片（Dashboard 工廠範圍、機台詳情機台範圍）渲染三種狀態：已載入摘要（+ `recommendedActions` 清單 + 重新產生按鈕）、`404 SUMMARY_NOT_FOUND` → 帶「Generate」行動呼籲的空狀態、`502 LLM_CALL_FAILED` → 帶重試的行內錯誤，頁面其餘不受影響。POST 按鈕在同步 LLM 呼叫期間顯示載入狀態。

### D7：Event Center 只按 eventType 上色

列標籤把 `eventType → 顏色` 映射（例如 `ERROR_OCCURRED` 紅、`MAINTENANCE_REQUIRED` 橙、`PRODUCTION_COMPLETED` 綠）— 不推導 severity，保留 `docs/product/mvp.md`（「Why There Is No Severity Column」）記載的事實/詮釋分離。分頁經 API 的 `before` 游標加「Load more」按鈕。

### D8：Compose 跑 Vite dev server；後端啟用 CORS

`frontend/Dockerfile` 在 :5173 跑 `npm run dev -- --host`（對應被註解的 compose 占位；熱重載讓容器在開發期間保持有用 — production build stage 是之後的事）。瀏覽器直接呼叫 `:3000`，所以 `main.ts` 加 `app.enableCors()`（全開，與 api.md §2.6 的無驗證 MVP 姿態一致）。

## 風險 / 取捨

- [5 秒輪詢放大請求量（4-5 個查詢 × 開啟的頁面）] → 一個 demo 使用者沒問題；vue-query 對相同 key 去重，且預設在分頁隱藏時暫停輪詢。300 台機台的答案是 Phase 2 的 WebSocket，不是更快的輪詢。
- [手抄型別從 api.md 漂移] → 每個型別帶著它的 api.md § 參照；文件同步規則讓契約修改一定會動到 api.md，按章節 grep 就能找到前端的雙胞胎。等端點數量夠多再 codegen。
- [全開的 CORS] → 符合 MVP 明確的無驗證範圍；Phase 2 加驗證時重新檢視。
- [machines collection 為空時 `averageHealthScore` 除以零] → 聚合回傳零填滿的形狀、`machineCount: 0`、`averageHealthScore: null`；前端渲染「—」。
- [Naive UI 鎖定視覺語言] → 可接受；之後若有品牌需求，經它的 ConfigProvider 做主題化。

## 未決問題

1. 機台詳情行內顯示近期事件 — 重用 Event Center 的表格元件按機台篩選，還是更輕的清單？（實作時決定；傾向重用。）
2. Dashboard 的「Recent Events」小工具要不要帶機台篩選深連結到 Event Center？（加分項；不阻塞。）
