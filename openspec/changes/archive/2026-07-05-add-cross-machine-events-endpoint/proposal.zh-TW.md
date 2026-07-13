## 為什麼

即將到來的 Vue 前端需要一個 Event Center 畫面，顯示跨機台、最新在前的事件時間軸（`docs/product/mvp.md` §Event Center），加上一個 Dashboard 的「Recent Events」小工具。今天唯一存在的事件讀取端點 `GET /machines/:id/events` 侷限於單一機台 — 沒有辦法取得全廠的事件流。這個缺口是在探索前端資料需求時、任何前端程式碼存在之前被發現的，所以在前端工作之前，先以獨立的小型後端變更把它補上。

## 改什麼

- 新增 `GET /events`，一個頂層的跨機台事件歷史端點，重用與既有 `GET /machines/:id/events` 相同的游標式分頁（`limit`、`before`）與回應信封（`data` + `pagination.nextCursor`/`hasMore`）。
- `GET /events` 支援與侷限端點相同的 `eventType` 篩選，加上新的選填 `machineId` 篩選（讓 Event Center 自己的機台篩選可以呼叫一個端點，而不是在兩個之間切換）。
- `GET /machines/:id/events` 不變 — 兩個端點共用同一套底層 `EventsService` 查詢邏輯，差別只在 `machineId` 是固定的路徑參數還是選填的查詢篩選。
- 不新增跨機台的 `GET /alerts` 端點。5 個記載的 MVP 畫面（`docs/product/mvp.md`）沒有一個需要全廠告警流 — `Machine Detail` 是唯一的告警消費者，且已由 `GET /machines/:id/alerts` 服務。等真的有畫面需要時再加（YAGNI）。

## 能力

### 新能力

（無）

### 修改的能力

- `event-history`：在既有的按機台需求之外，新增一條跨機台、分頁的事件查詢需求。事件持久化方式與既有的按機台需求皆不變。

## 影響

- **程式碼**：`backend/src/events/events.service.ts`（把查詢邏輯重構為接受選填而非必填的 `machineId`）、`backend/src/events/events.controller.ts`（新路由）、`backend/src/events/events.module.ts`（預期不變 — 同樣的 provider）。
- **API 契約**：`docs/design/api.md` 新增 `GET /events` 的 §4.x 條目，§3 資源總覽的 `Event` 列可註明兩種存取路徑。
- **文件**：`docs/product/mvp.md` 的 Event Center 與 Dashboard 章節已預期此端點（那邊不需要進一步文件變更 — 見前一次探索工作階段的 Event Center 改寫）。
- **無前端變更** — 本變更僅後端，先行於之後會消費它的獨立 Vue 前端變更。
