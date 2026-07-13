## 1. 共用型別

- [x] 1.1 在 `backend/src/shared/types/machine-event.types.ts` 加入 `StatusChangedPayload`（`previousStatus?`、`currentStatus` 必填、`reason?`）與 `StatusChangedEvent` 型別，依 `event-schema.md` §5.1
- [x] 1.2 加入 `ErrorOccurredPayload`（`errorCode`、`errorMessage` 必填、`recoverable?`）與 `ErrorOccurredEvent` 型別，依 `event-schema.md` §5.3
- [x] 1.3 加入 `MaintenanceRequiredPayload`（`maintenanceType`、`reason` 必填）與 `MaintenanceRequiredEvent` 型別，依 `event-schema.md` §5.4
- [x] 1.4 加入 `ProductionCompletedPayload`（`quantity` 必填、`batchId?`）與 `ProductionCompletedEvent` 型別，依 `event-schema.md` §5.5
- [x] 1.5 把 `IMPLEMENTED_EVENT_TYPES` 擴大到全部 5 種 MVP 事件類型，加入涵蓋全部 5 種事件+payload 組合的 `MachineEvent` 聯集型別；移除過期的「本變更只實作 TEMPERATURE_REPORTED」檔案註解

## 2. Simulator（事件攝取）

- [x] 2.1 在 `backend/src/simulator/simulator.service.ts` 為每種事件類型加入 payload 驗證器（`validateStatusChangedPayload`、`validateErrorOccurredPayload`、`validateMaintenanceRequiredPayload`、`validateProductionCompletedPayload`），缺必填欄位時各自拋出 `PAYLOAD_VALIDATION_FAILED`
- [x] 2.2 依 `body.eventType` 分派到正確的驗證器，不再一律呼叫 `validateTemperatureReportedPayload`
- [x] 2.3 把僅限 `TemperatureReportedEvent` 的轉型改為任務 1.5 的 `MachineEvent` 聯集型別

## 3. Machine Service（投影）

- [x] 3.1 在 `backend/src/machines/machine-projection-consumer.service.ts`，把 `if (event.eventType !== 'TEMPERATURE_REPORTED') return;` 防護改為涵蓋全部 5 種類型的按事件類型分派（switch 或 if/else）
- [x] 3.2 實作 `STATUS_CHANGED`：直接設 `machine.status = event.payload.currentStatus`（繞過 `raiseSeverity`）；若 `currentStatus === 'WARNING'` 套用 `healthScore -15`（截限）；否則健康分數不變 — 依 `design.md` 決策 1
- [x] 3.3 實作 `ERROR_OCCURRED`：`machine.status = raiseSeverity(machine.status, 'ERROR')`、`healthScore -30`（截限）
- [x] 3.4 實作 `MAINTENANCE_REQUIRED`：`machine.status = raiseSeverity(machine.status, 'MAINTENANCE')`、`healthScore -20`（截限）
- [x] 3.5 實作 `PRODUCTION_COMPLETED`：`machine.status = raiseSeverity(machine.status, 'RUNNING')`、`healthScore +2`（截限）、`machine.productionCount += event.payload.quantity`
- [x] 3.6 確認既有的 `lastEventId`/冪等性檢查與 `handleMessage` 結尾的 `lastEventId`/`lastUpdatedAt` 更新一致地適用於全部 5 個分支（沒有按類型的重複）

## 4. Alert Service

- [x] 4.1 在 `backend/src/alerts/alert-consumer.service.ts`，把 `if (event.eventType !== 'TEMPERATURE_REPORTED') return;` 防護改為涵蓋全部 5 種類型的按事件類型分派
- [x] 4.2 實作 `ERROR_OCCURRED`：一律建立 `severity: 'CRITICAL'` 告警
- [x] 4.3 實作 `MAINTENANCE_REQUIRED`：一律建立 `severity: 'WARNING'` 告警
- [x] 4.4 實作 `STATUS_CHANGED`：只在 `payload.currentStatus === 'WARNING'` 時建立 `severity: 'WARNING'` 告警；否則不建立
- [x] 4.5 實作 `PRODUCTION_COMPLETED`：不建立告警（明確的 no-op 分支，不是無聲的 fallthrough）
- [x] 4.6 確認既有的 duplicate-key 冪等處理包住全部 4 個新的 `alertModel.create` 呼叫點，不只是 `TEMPERATURE_REPORTED` 那個

## 5. 文件修正

- [x] 5.1 在 `docs/design/machine-schema.md` §7，把未定義的 `isSensorFailure(event.payload.reason)` 虛擬碼呼叫改為直接的 `event.payload.currentStatus == "WARNING"` 檢查，並加一段短註記，記載這是 MVP 的感測器故障規則（依本變更 `design.md` 決策 1）

## 6. 手動驗證（真實運行系統，不只是 build）

- [x] 6.1 重建並重啟 `backend` 容器（`docker compose up -d --build backend`）
- [x] 6.2 為目前 `RUNNING` 的機台 POST 一個 `currentStatus: "WARNING"` 的 `STATUS_CHANGED` 事件；驗證 `202`、建立一筆 `machine_events` 文件、`machine.status` 變為 `WARNING`、`healthScore` 掉 15，並建立 `ACTIVE`/`WARNING` 告警
- [x] 6.3 為目前 `ERROR` 的機台 POST 一個 `currentStatus: "RUNNING"` 的 `STATUS_CHANGED` 事件；驗證嚴重度優先序繞過生效 — 儘管 `ERROR` 等級較高，`status` 確實變為 `RUNNING` — 並確認不建立告警、`healthScore` 不變
- [x] 6.4 POST 一個 `ERROR_OCCURRED` 事件；驗證 `status` 變為 `ERROR`、`healthScore` 掉 30，並建立 `CRITICAL` 告警
- [x] 6.5 POST 一個 `MAINTENANCE_REQUIRED` 事件；驗證 `status` 變為 `MAINTENANCE`、`healthScore` 掉 20，並建立 `WARNING` 告警
- [x] 6.6 為目前 `IDLE` 的機台 POST 一個 `quantity: 5` 的 `PRODUCTION_COMPLETED` 事件；驗證 `productionCount` 增加 5、`healthScore` 增加 2、`status` 變為 `RUNNING`，且不建立告警
- [x] 6.7 為目前 `ERROR` 的機台 POST 一個 `PRODUCTION_COMPLETED` 事件；驗證 `status` 維持 `ERROR` 而 `healthScore` 與 `productionCount` 仍更新（健康分數與狀態排序彼此獨立，依 `machine-schema.md` §5.2）
- [x] 6.8 重新 POST 一個已處理過的 `eventId`；驗證沒有建立重複的 `machine_events`/`alerts` 文件，且機台投影的健康分數/狀態沒有被重複套用
- [x] 6.9 對被上述事件觸及的機台 GET `/machines/:id/events` 與 `/machines/:id/alerts`；驗證所有新事件類型與告警正確出現

## 7. OpenSpec 收尾

- [x] 7.1 執行 `openspec validate remaining-mvp-event-types --strict` 並確認通過
- [x] 7.2 上述所有任務完成並驗證後歸檔此變更
