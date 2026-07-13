## 1. limit=0 修復

- [x] 1.1 在 `backend/src/events/events.service.ts` 的 `listEvents()`，把 `Number(query.limit) || DEFAULT_LIMIT` 換成明確的 `query.limit !== undefined ? Number(query.limit) : DEFAULT_LIMIT` 檢查，保留既有的 `Math.max(..., 1)` / `Math.min(..., MAX_LIMIT)` 截限

## 2. 共用 Mongo 錯誤工具

- [x] 2.1 建立 `backend/src/shared/database/mongo-error.util.ts`，匯出 `isDuplicateKeyError(err: unknown): boolean`，從 `event-consumer.service.ts` 與 `alert-consumer.service.ts` 完全相同的私有方法移出
- [x] 2.2 更新 `backend/src/events/event-consumer.service.ts` 改為 import 並使用共用函式，刪除其私有副本
- [x] 2.3 更新 `backend/src/alerts/alert-consumer.service.ts` 改為 import 並使用共用函式，刪除其私有副本

## 3. 移除死的型別別名

- [x] 3.1 在 `backend/src/shared/types/machine-event.types.ts` 刪除 `IMPLEMENTED_EVENT_TYPES` 與 `ImplementedEventType`
- [x] 3.2 在 `backend/src/simulator/simulator.service.ts`，把 `IMPLEMENTED_EVENT_TYPES` 的唯一使用處換成 `MVP_EVENT_TYPES`

## 4. 感測器故障契約測試

- [x] 4.1 在 `backend/src/machines/machine-projection-consumer.service.ts`，把 `STATUS_CHANGED` 感測器故障檢查抽成具名函式 `isStatusChangedSensorFailure(currentStatus: string): boolean`，由既有的 switch 分支呼叫
- [x] 4.2 在 `backend/src/alerts/alert-consumer.service.ts`，把對等的檢查抽成同名、同邏輯（但不共用/不互相 import）的函式 `isStatusChangedSensorFailure(currentStatus: string): boolean`，修正 code review 發現的相反極性（`!== 'WARNING'` → 函式應對 `'WARNING'` 回傳 `true`，與 Machine Service 的定義一致）
- [x] 4.3 新增 `backend/src/shared/sensor-failure-contract.spec.ts`，import 兩個 `isStatusChangedSensorFailure` 函式，對全部 5 個 `MachineStatus` 值加一個無法辨識的字串斷言一致
- [x] 4.4 執行 `npm test`（Jest）— 通過（9/9）。過程中被一個計畫外但必要的修復解鎖：這是第一個傳遞性載入 `Machine`/`Alert` Mongoose schema 的測試，翻出一個既有的潛伏問題（`@nestjs/mongoose` 的裝飾器在沒有明確 `type: String` 時無法為字串字面值聯集的 `@Prop()` 欄位解析 `design:type`），影響 `Machine.status`、`Alert.severity`、`Alert.status` — 為三者加上 `type: String`，無行為變更（Mongoose 已透過 `enum` 驗證）

## 5. 手動驗證（真實運行系統，不只是 build）

- [x] 5.1 重建並重啟 `backend` 容器（`docker compose up -d --build backend`）
- [x] 5.2 GET `/events?limit=0`；驗證最多回傳 1 筆事件，不是預設 20 筆
- [x] 5.3 POST 一個超過閾值的 `TEMPERATURE_REPORTED` 事件與一個到 `WARNING` 的 `STATUS_CHANGED` 事件；驗證兩者仍正確建立告警（對移動後的 `isDuplicateKeyError` 與抽出的感測器故障函式做回歸檢查）
- [x] 5.4 重新 POST 一個已處理過的 `eventId`；驗證 Event Service 與 Alert Service 的冪等性仍有效（對 `isDuplicateKeyError` 新共用位置的回歸檢查）

## 6. 第二輪 Code-Review 修復

- [x] 6.1 `backend/src/machines/machine-projection-consumer.service.ts`：為 `TEMPERATURE_REPORTED` 加上 `Number.isFinite(temperature)` 防護，呼應 `alert-consumer.service.ts` 既有的防護；無效輸入時記 warn 並跳過
- [x] 6.2 `backend/src/events/events.service.ts`：修復任務 1.1 引入的回歸 — 非數字的 `limit`（例如 `?limit=abc`）現在產生 `NaN`；對解析後的值加 `Number.isFinite` 檢查，非有限時退回 `DEFAULT_LIMIT`
- [x] 6.3 `backend/src/alerts/alert-consumer.service.ts`：為 `resolveAlert` 的 switch 加上記錄無法辨識 `eventType` 的 `default` 分支，呼應 `machine-projection-consumer.service.ts` 的對等分支
- [x] 6.4 `backend/src/alerts/alert-consumer.service.ts`：為 `TEMPERATURE_REPORTED` 無效溫度分支加上 warn 日誌，堵上規格/程式碼不一致（`openspec/specs/alert-detection/spec.md` 早已寫「logged as skipped」）
- [x] 6.5 `backend/src/alerts/alert-consumer.service.ts`：把 `Number.isFinite(temperature)` 檢查重排到 `machinesService.findRaw()` 之前，避免對格式錯誤的 payload 浪費一次 DB 往返
- [x] 6.6 `backend/src/simulator/simulator.service.ts`：`schemaVersion` 驗證從 `typeof !== 'number'` 改為 `Number.isFinite(...)`，因為 `typeof NaN`/`typeof Infinity` 都是 `'number'`
- [x] 6.7 `backend/src/shared/kafka/kafka-consumer.base.ts`：把基底類別的 logger 升為 `protected readonly logger`，全部 3 個子類別經 `this.logger` 重用；移除 `event-consumer.service.ts`、`machine-projection-consumer.service.ts`、`alert-consumer.service.ts` 中如今冗餘的 `private readonly logger = new Logger(...)`（以及 `event-consumer.service.ts` 中從未使用自己副本、如今無用的 `Logger` import）
- [x] 6.8 把 2 處引用歸檔前路徑 `openspec/changes/kafka-consumer-reliability-hardening/design.md` 的註解更新為歸檔後路徑
- [x] 6.9 為兩個新行為加規格 delta：`machine-state-projection`（非有限溫度不毀損投影）與 `alert-detection`（無法辨識的 eventType 不建立告警、有記錄）
- [x] 6.10 重建、重啟後端，手動驗證：`GET /events?limit=abc` → 退回 20（先前是 NaN）；`GET /events?limit=0` → 仍截限到 1（無回歸）；直接發布到 Kafka 的 `temperature: 1e400`（JSON 解析為 `Infinity`）`TEMPERATURE_REPORTED` 事件讓 `currentTemperature` 維持在 95 不變（未毀損），且 `AlertConsumerService` 與 `MachineProjectionConsumerService` 都記錄「Skipping non-finite temperature」；直接發布到 Kafka 的無法辨識 `eventType` 被兩個 consumer 記錄為已跳過（確認新的 Alert Service `default` 分支與 logger 整併重構都有效）；在 `M-003` 上的完整 5 事件類型 happy-path 回歸精確符合預期的 status/healthScore/productionCount/currentTemperature
- [x] 6.11 再跑一次 `npm test`，確認 logger 重構後感測器故障契約測試與 app.controller.spec.ts 仍通過 — 9/9 通過；`npx tsc --noEmit`、`npm run build`、`npm run lint` 全部乾淨（lint 只剩 `event-consumer.service.ts`/`main.ts` 中同樣 2 個既有的無關問題）

**明確延後、本變更未修復**：`KafkaConsumerBase` 的 catch-all 吞掉暫時性基礎設施錯誤（不只格式錯誤的訊息）— 這是真實的設計問題（見 `design.md` 風險補遺），浮報給使用者而非默默解決。Machine Service 與 Alert Service 之間重複且無契約測試的溫度閾值比較 — 已在 `machine-schema.md` §5.4 與感測器故障重複一起接受為延後債務；不視為新的行動項目。

## 7. OpenSpec 收尾

- [x] 7.1 執行 `openspec validate duplicate-logic-cleanup --strict` 並確認通過
- [x] 7.2 上述所有任務完成並驗證後歸檔此變更
