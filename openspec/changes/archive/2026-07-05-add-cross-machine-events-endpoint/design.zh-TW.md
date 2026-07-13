## 脈絡

`backend/src/events/events.service.ts` 的 `listEventsForMachine(machineId, query)` 已經對整個 collection 正確實作游標式分頁：游標查找（`findOne({ eventId: query.before })`）與排序（`{ _id: -1 }`）都作用於完整的 `machine_events` collection，而非按機台的子集 — `machineId` 只是作為額外的 `find()` 篩選套用。這表示既有的分頁邏輯已經能泛化到跨機台的事件流；唯一需要的改動是把 `machineId` 篩選從必填改為選填，並新增一條不提供它的路由。

這個設計是在寫任何程式碼之前的探索工作階段中定案的 — 為什麼此端點只涵蓋原始事件、不含衍生的告警資料，見導致 `docs/product/mvp.md` Event Center 改寫（移除 `Severity` 欄）的那次討論。

## 目標 / 非目標

**目標：**
- 新增 `GET /events`（跨機台），與既有 `GET /machines/:id/events` 共用分頁/游標邏輯。
- `GET /machines/:id/events` 的行為與回應形狀逐位元組維持不變 — 這是純新增，不是破壞性變更。
- 新端點支援選填的 `machineId` 查詢篩選，讓 Event Center 自己的機台篩選不需要呼叫不同端點。

**非目標：**
- 不新增跨機台的 `GET /alerts` 端點（見提案的 YAGNI 理由）。
- 不新增持久化、索引或綱要變更 — `machine_events` 已具備所需（預設的 `_id` 排序、既有的 `machineId` 欄位）。
- 本變更不含前端工作。

## 決策

### 1. 一個共用的 service 方法、兩個 controller

NestJS 把一個 controller 綁定到單一路徑前綴，所以 `/machines/:id/events` 與 `/events` 需要不同的 controller 類別。與其重複查詢邏輯，`EventsService` 提供一個方法：

```typescript
async listEvents(query: {
  machineId?: string;
  limit?: string;
  before?: string;
  eventType?: string;
}): Promise<{ data: EventResponse[]; pagination: PaginationMeta }>
```

- `EventsController`（`@Controller('machines/:id/events')`）呼叫 `listEvents({ machineId: id, ...query })`，並如同今天一樣先驗證 `machineId` 存在（404 `MACHINE_NOT_FOUND`）。
- 新的 `EventsListController`（`@Controller('events')`）直接呼叫 `listEvents(query)`，`machineId` 來自選填的查詢參數。若提供了 `machineId` 但不存在，為了一致性仍以 `MACHINE_NOT_FOUND` 回 404；若省略，不執行存在性檢查（沒有可驗證的對象）。

曾考慮的替代方案：保留兩個獨立的 service 方法（`listEventsForMachine` 與 `listAllEvents`），避免動到可運作的程式碼。否決 — 查詢建構邏輯（游標查找、排序、`limit + 1`/`hasMore` 技巧）會被逐字重複，未來任何分頁行為的變更都得改兩次。

### 2. `machineId` 篩選對兩條路由以相同方式套用

泛化後的方法只在 `if (query.machineId)` 時建立 `filter.machineId = query.machineId`，否則 `find()` 不加篩選地跨所有機台執行。這是與目前實作唯一的功能差異 — 其他一切（`eventType` 篩選、游標 `_id` 查找、`limit + 1`/`hasMore` 分頁）原樣照搬。

### 3. 兩個端點的回應形狀完全相同

兩者都回傳 `{ data: [...], pagination: { limit, nextCursor, hasMore } }`，每筆事件欄位相同（`eventId`、`eventType`、`schemaVersion`、`source`、`machineId`、`occurredAt`、`producedAt`、`correlationId`、`payload`）。跨機台的回應每筆事件都含 `machineId`（本來就有，因為它是信封的一部分），讓前端的 Event Center 不需要第二次查找就能顯示「Machine」欄。

## 風險 / 取捨

- **[風險] 不帶篩選的 `GET /events` 在 `machine_events` 隨時間變大後可能回傳大量資料。** → **緩解**：與侷限端點相同的 `limit`/`before` 游標分頁已經約束了這點；預設 `limit`（20）與最大值（100）同樣適用。風險輪廓與既有端點沒有不同，只是每頁的結果集更廣。
- **[風險] 兩個 controller 呼叫同一個 service 方法，若有人只改一處呼叫端的查詢建構而沒檢查另一處，可能漂移。** → **緩解**：兩個呼叫端都直通同一個 `listEvents()` 簽名；遵循 `ai/rules/module-boundaries.md` 的 code reviewer 應能抓到任何不對稱，且本設計文件為未來留下了預期對等性的紀錄。

## 遷移計畫

無資料遷移。純加法：`GET /machines/:id/events` 照常運作不變；`GET /events` 是新路由。以正常的後端重建部署。
