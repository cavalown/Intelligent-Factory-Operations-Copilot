## 1. 後端 Service

- [x] 1.1 在 `backend/src/events/events.service.ts`，把 `listEventsForMachine(machineId, query)` 泛化為 `listEvents(query: { machineId?: string; limit?: string; before?: string; eventType?: string })`，只在 `machineId` 存在時套用該篩選
- [x] 1.2 機台存在性檢查（`assertMachineExists`，404 `MACHINE_NOT_FOUND`）以 `machineId` 存在為前提 — 省略 `machineId` 時跳過
- [x] 1.3 確認游標分頁（經 `findOne({ eventId })` 的 `before` 查找、`sort({ _id: -1 })`、`limit + 1`/`hasMore` 切片）不變且仍作用於整個 collection，依 `design.md` 決策 1

## 2. 後端 Controller

- [x] 2.1 更新 `backend/src/events/events.controller.ts`（`@Controller('machines/:id/events')`）改呼叫泛化後的 `listEvents({ machineId: id, ...query })`
- [x] 2.2 新增 `EventsListController`（`@Controller('events')`），其 `GET` 路由呼叫 `listEvents(query)`，從查詢參數讀取 `machineId`、`eventType`、`limit`、`before`
- [x] 2.3 在 `backend/src/events/events.module.ts` 註冊新 controller

## 3. API 契約文件

- [x] 3.1 在 `docs/design/api.md` §4 新增 `GET /events` 條目（作為 §4.4，把既有的 §4.4–§4.7 重編為 §4.5–§4.8），記載查詢參數（`limit`、`before`、`eventType`、`machineId`）、回應形狀（與 §4.3 相同的信封），以及提供未知 `machineId` 篩選時的 `404 MACHINE_NOT_FOUND` 情況
- [x] 3.2 更新 `docs/design/api.md` §3 資源總覽的 `Event` 列，註明兩種存取路徑（按機台與跨機台）

## 4. 手動驗證（真實運行系統，不只是 build）

- [x] 4.1 重建並重啟 `backend` 容器（`docker compose up -d --build backend`）
- [x] 4.2 不帶查詢參數 GET `/events`；驗證回傳跨多台機台（不只一台）的事件、最新在前、分頁中繼資料正確
- [x] 4.3 GET `/events?machineId=M-001`；驗證回應與 `GET /machines/M-001/events` 完全一致（相同事件、相同形狀）
- [x] 4.4 GET `/events?eventType=ERROR_OCCURRED`；驗證只回傳該事件類型、跨機台
- [x] 4.5 GET `/events?machineId=M-999`（未知機台）；驗證 `404` 與 `MACHINE_NOT_FOUND`
- [x] 4.6 GET `/machines/M-001/events`（既有端點）；驗證仍照常運作不變，確認無回歸
- [x] 4.7 在 `/events` 測試游標分頁（`limit=2` 然後以 `before` 跟隨 `nextCursor`）；驗證跨頁無重複或遺漏的事件

## 5. OpenSpec 收尾

- [x] 5.1 執行 `openspec validate add-cross-machine-events-endpoint --strict` 並確認通過
- [x] 5.2 上述所有任務完成並驗證後歸檔此變更
