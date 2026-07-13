## 1. Consumer 錯誤邊界

- [x] 1.1 在 `backend/src/shared/kafka/kafka-consumer.base.ts` 加入 `Logger` 實例，並把 `eachMessage` callback 中對 `this.handleMessage(payload)` 的呼叫包在 try/catch 裡，記錄錯誤（訊息 + 堆疊）且不重新拋出
- [x] 1.2 確認此變更一致地適用於全部 3 個子類別（`EventConsumerService`、`MachineProjectionConsumerService`、`AlertConsumerService`），不需要各子類別的變更，依 `design.md` 決策 1

## 2. Simulator 驗證缺口

- [x] 2.1 在 `backend/src/simulator/simulator.service.ts`，更新 `validateEnvelope` 以拒絕不是數字的 `schemaVersion`，使用錯誤代碼 `INVALID_EVENT_ENVELOPE`（400）— 與既有的缺欄位檢查同一代碼
- [x] 2.2 更新 `validateStatusChangedPayload` 以拒絕不屬於 5 個允許 `MachineStatus` 值（`RUNNING`、`IDLE`、`WARNING`、`ERROR`、`MAINTENANCE`）的 `currentStatus`，使用錯誤代碼 `PAYLOAD_VALIDATION_FAILED`（422）— 標準的 `MACHINE_STATUSES` 移到 `shared/types/machine-status.types.ts`（從 `machines/schemas/machine.schema.ts` 重新匯出），讓 `simulator/` 可以 import 而不需伸手進另一個模組的 schema 檔案，依 `ai/rules/module-boundaries.md`

## 3. Machine Service 防護

- [x] 3.1 在 `backend/src/machines/machine-projection-consumer.service.ts`，為事件類型 switch 加上 `default` 分支，直接返回而不更新 `lastEventId`/`lastUpdatedAt`/不呼叫 `save()`
- [x] 3.2 在 `PRODUCTION_COMPLETED` 分支，把 `machine.productionCount += event.payload.quantity` 放在 `Number.isFinite(event.payload.quantity)` 檢查之後 — 選擇只跳過 `productionCount` 遞增（不是整個事件），因為 `status`/`healthScore` 效果不依賴 `quantity` 有效；無論如何都記錄警告

## 4. Alert Service 防護

- [x] 4.1 在 `backend/src/alerts/alert-consumer.service.ts` 的 `resolveAlert`，防護 `TEMPERATURE_REPORTED` 情況：缺失/非有限的 `temperature` 回傳 `null`（不建立告警），而不是繼續進行閾值比較

## 5. 手動驗證（真實運行系統，不只是 build）

- [x] 5.1 重建並重啟 `backend` 容器（`docker compose up -d --build backend`）
- [x] 5.2 POST 一個 `currentStatus: "BOGUS"` 的 `STATUS_CHANGED` 事件；驗證 `422 PAYLOAD_VALIDATION_FAILED` 且不發布到 Kafka（先前這會崩潰 Machine Service）
- [x] 5.3 POST 一個 `schemaVersion: "abc"` 的事件；驗證 `400 INVALID_EVENT_ENVELOPE` 且不發布到 Kafka（先前這會崩潰 Event Service）
- [x] 5.4 確認上述兩者之後後端容器都沒有崩潰/重啟（檢查 `docker logs ifoc-backend` 中先前的崩潰特徵、確認不存在；檢查 `docker compose ps` 顯示 `ifoc-backend` 仍為 `Up`、不是 `Restarting`）
- [x] 5.5 直接對 `machine.events` topic 手動發布一則格式錯誤（非 JSON）的訊息（透過針對 `localhost:9093` 的一次性 kafkajs 腳本），確認全部 3 個 consumer group（`EventConsumerService`、`MachineProjectionConsumerService`、`AlertConsumerService`）記錄錯誤但持續處理之後發布的有效事件 — 已確認：緊接著發布的 `TEMPERATURE_REPORTED` 事件被正常處理
- [x] 5.6 透過直接 Kafka 發布（繞過 simulator 驗證）、`PRODUCTION_COMPLETED` payload 省略 `quantity` 驗證：`productionCount` 維持不變（不是 `NaN`）、`healthScore`/`status` 仍正常更新、有記錄警告
- [x] 5.7 重跑完整的事件類型驗證矩陣（在 `M-003` 上經有效的 `/simulator/events` 呼叫送全部 5 種事件類型）；最終的 `status`/`healthScore`/`productionCount`/告警全部精確符合預期值，無回歸

## 6. OpenSpec 收尾

- [x] 6.1 執行 `openspec validate kafka-consumer-reliability-hardening --strict` 並確認通過
- [x] 6.2 上述所有任務完成並驗證後歸檔此變更
