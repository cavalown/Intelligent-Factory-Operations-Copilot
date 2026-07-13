## 為什麼

Walking skeleton（`backend-walking-skeleton`）只用 5 種 MVP 事件類型中的一種（`TEMPERATURE_REPORTED`）證明了端到端管線（`simulator → Kafka → 3 consumers → MongoDB → REST API`）。在其餘 4 種事件類型 — `STATUS_CHANGED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED` — 流過同一條管線之前，MVP 的功能還不算完整，因為 `docs/product/mvp.md` 與 `docs/design/machine-schema.md` 已記載全部 5 種的規則。

## 改什麼

- Simulator 驗證（`SimulatorService`）接受並對其餘 4 種事件類型做 payload 驗證，不再以 `UNSUPPORTED_EVENT_TYPE` 拒絕它們。
- Event Service consumer 把其餘 4 種事件類型原封不動持久化進 `machine_events`（儲存層本來就與類型無關，但消費的集合擴大）。
- Machine Service consumer（`MachineProjectionConsumerService`）實作 `docs/design/machine-schema.md` §4.3/§5.2 的各事件類型狀態/健康分數規則：
  - `STATUS_CHANGED`：直接把 `status` 設為 `payload.currentStatus`（唯一被允許覆寫嚴重度優先序、包括降級的事件類型）；只有變更原因是感測器故障時才建立 WARNING 告警。
  - `ERROR_OCCURRED`：把 `status` 設為 `ERROR`（與其他非 `STATUS_CHANGED` 事件一樣受嚴重度優先序約束），`healthScore -30`。
  - `MAINTENANCE_REQUIRED`：把 `status` 設為 `MAINTENANCE`（受嚴重度優先序約束），`healthScore -20`。
  - `PRODUCTION_COMPLETED`：在嚴重度優先序允許時把 `status` 設為 `RUNNING`，`healthScore +2`（上限 100），`productionCount += payload.quantity`。
- Alert Service consumer（`AlertConsumerService`）按事件類型建立告警：`ERROR_OCCURRED` 為 CRITICAL、`MAINTENANCE_REQUIRED` 為 WARNING、`STATUS_CHANGED` 只在原因為感測器故障時 WARNING、`PRODUCTION_COMPLETED` 不建立告警。
- `backend/src/shared/types/machine-event.types.ts` 的 `IMPLEMENTED_EVENT_TYPES` 從 `['TEMPERATURE_REPORTED']` 擴展到全部 5 種 MVP 事件類型，每種事件類型有新的型別化 payload interface。
- 沒有新的 REST 端點或路由形狀 — 既有的 `GET /machines`、`GET /machines/:id`、`GET /machines/:id/events`、`GET /machines/:id/alerts` 本來就回傳 collection 裡存在的一切，不管是哪種事件類型產生的。

## 能力

### 新能力

（無 — 本變更把既有能力擴展到其餘事件類型，而非引入新能力）

### 修改的能力

- `machine-event-ingestion`：「拒絕不支援的事件類型」需求縮限到僅剩真正不支援的情況（MVP 範圍內已無）；新需求涵蓋 4 種額外事件類型各自的 payload 驗證。
- `machine-state-projection`：「嚴重度優先序被強制執行」需求從「只有 `STATUS_CHANGED` 事件可以[降級狀態]（不在本變更範圍）」改為實際實作該例外，加上 `ERROR_OCCURRED`、`MAINTENANCE_REQUIRED` 與 `PRODUCTION_COMPLETED` 的狀態/健康分數/生產數量規則的新需求。
- `alert-detection`：`ERROR_OCCURRED` 的 CRITICAL 告警、`MAINTENANCE_REQUIRED` 的 WARNING 告警、`STATUS_CHANGED` 的條件式 WARNING 告警（僅感測器故障原因），以及 `PRODUCTION_COMPLETED` 不告警的新需求。
- `event-history`：「不可變地持久化已消費的事件」需求從僅 `TEMPERATURE_REPORTED` 擴大到全部 5 種 MVP 事件類型（情境層級無變更，因為持久化本來就與信封形狀無關）。

## 影響

- **程式碼**：`backend/src/shared/types/machine-event.types.ts`、`backend/src/simulator/simulator.service.ts`、`backend/src/machines/machine-projection-consumer.service.ts`、`backend/src/machines/machine-status.util.ts`、`backend/src/alerts/alert-consumer.service.ts`。`events/` 除了型別聯集擴大外預期不變，任何 controller 或 schema 皆不變。
- **規格**：`openspec/specs/{machine-event-ingestion,machine-state-projection,alert-detection,event-history}/spec.md` 都在本變更中獲得 delta 規格。
- **文件**：`docs/design/machine-schema.md` §7 需要小幅修正 — 其 `isSensorFailure(reason)` 虛擬碼呼叫未定義（見 `design.md` 決策 1）；本變更以直接的 `currentStatus == "WARNING"` 檢查取代，並記載為 MVP 規則。`docs/design/event-schema.md` 與 `docs/design/architecture.md` §9.3 已規格化其他所需的一切；預期無其他文件變更。
- **依賴**：無新增。
