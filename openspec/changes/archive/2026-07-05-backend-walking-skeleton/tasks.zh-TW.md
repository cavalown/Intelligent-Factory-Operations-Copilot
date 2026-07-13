## 1. 後端專案骨架

- [x] 1.1 在 `backend/` 初始化 NestJS 專案（TypeScript）
- [x] 1.2 依 `docs/design/architecture.md` §14.1 建立模組資料夾：`events/`、`machines/`、`alerts/`、`insights/`、`simulator/`、`shared/`
- [x] 1.3 加入依賴：`kafkajs`、`@nestjs/mongoose`、`mongoose`（`@nestjs/microservices` 先加入後移除 — 見 `design.md` 決策）
- [x] 1.4 依 `docs/deployment/docker-compose.md` §5 接上環境變數（`PORT`、`MONGODB_URI`、`KAFKA_BROKERS`、`KAFKA_TOPIC_MACHINE_EVENTS`）

## 2. 共用基礎設施（`shared/`）

- [x] 2.1 定義符合 `docs/design/event-schema.md` §3 的事件信封型別/DTO
- [x] 2.2 定義符合 `docs/design/event-schema.md` §5.2 的 `TEMPERATURE_REPORTED` payload DTO
- [x] 2.3 建立直接包裝 `kafkajs` 的 Kafka 模組（共用 producer；consumer 工廠，每個呼叫者取得不同的 group ID）
- [x] 2.4 建立讀取 `MONGODB_URI` 的 Mongoose 連線模組

## 3. 機台 Seed

- [x] 3.1 定義符合 `docs/design/machine-schema.md` §3 的 Machine Mongoose schema
- [x] 3.2 撰寫啟動時的 seed 步驟，按 `machineId` upsert 固定的 demo 名單（至少 `M-001`「CNC Mill 01」、`temperatureThreshold: 80`、初始 `status: IDLE`、`healthScore: 100`，依 `machine-schema.md` §11）

## 4. 機台事件攝取（`simulator/`）— 能力：`machine-event-ingestion`

- [x] 4.1 實作 `POST /simulator/events` controller
- [x] 4.2 驗證必要信封欄位；失敗時回應 `400 INVALID_EVENT_ENVELOPE`
- [x] 4.3 驗證 `machineId` 存在於 `machines`；失敗時回應 `404 UNKNOWN_MACHINE`
- [x] 4.4 驗證 `eventType === TEMPERATURE_REPORTED`；否則回應 `422 UNSUPPORTED_EVENT_TYPE`
- [x] 4.5 驗證 `TEMPERATURE_REPORTED` payload（`temperature`、`unit` 必填）；失敗時回應 `422 PAYLOAD_VALIDATION_FAILED`
- [x] 4.6 把有效事件以 `machineId` 為 key 發布到 `machine.events`
- [x] 4.7 回應 `202 { eventId, status: "PUBLISHED" }`

## 5. 事件歷史（`events/`）— 能力：`event-history`

- [x] 5.1 定義 `MachineEvent` Mongoose schema，`eventId` 上有唯一索引，符合 `docs/design/architecture.md` §12.1
- [x] 5.2 實作有自己 consumer group（`event-service-group`）的 Kafka consumer，訂閱 `machine.events`
- [x] 5.3 消費時插入 `machine_events`；duplicate-key 錯誤接住並視為 no-op
- [x] 5.4 實作帶 `limit` + `before` 游標分頁的 `GET /machines/:id/events`
- [x] 5.5 對未知 `machineId` 回應 `404 MACHINE_NOT_FOUND`

## 6. 機台狀態投影（`machines/`）— 能力：`machine-state-projection`

- [x] 6.1 實作有自己 consumer group（`machine-service-group`）的 Kafka consumer，訂閱 `machine.events`
- [x] 6.2 消費時按 `machineId` 查找機台；若 `event.eventId === machine.lastEventId` 則跳過處理
- [x] 6.3 套用 `TEMPERATURE_REPORTED` 投影規則：超過閾值時把 `status` 提升為 `WARNING` 並把 `healthScore` 減 10（截限 `[0, 100]`），受嚴重度優先序約束（`machine-schema.md` §4.2）；否則只更新 `currentTemperature`
- [x] 6.4 每個處理過的事件都更新 `lastEventId` 與 `lastUpdatedAt`
- [x] 6.5 實作 `GET /machines`
- [x] 6.6 實作 `GET /machines/:id`；對未知 `machineId` 回應 `404 MACHINE_NOT_FOUND`

## 7. 告警偵測（`alerts/`）— 能力：`alert-detection`

- [x] 7.1 定義 `Alert` Mongoose schema，`eventId` 上有唯一索引，符合 `docs/design/architecture.md` §12.3
- [x] 7.2 實作有自己 consumer group（`alert-service-group`）的 Kafka consumer，訂閱 `machine.events`
- [x] 7.3 消費時，若 `temperature` 超過機台閾值就建立 `WARNING`/`ACTIVE` 告警；duplicate-key 錯誤接住並視為 no-op
- [x] 7.4 實作帶選填 `status` 篩選的 `GET /machines/:id/alerts`；對未知 `machineId` 回應 `404 MACHINE_NOT_FOUND`

## 8. Docker Compose 整合

- [x] 8.1 加入 `backend/Dockerfile`
- [x] 8.2 取消註解並對齊根 `docker-compose.yml` 的 `backend` 服務區塊
- [x] 8.3 與已運行的 `kafka`/`mongodb` 一起 `docker compose up --build backend`；確認無錯誤啟動（首次開機碰到一次性的冷啟動 consumer-group 競態 — 以 `restart: on-failure` 修復，記載於 `docker-compose.md` §4）

## 9. 端到端驗證

- [x] 9.1 執行 seed 步驟；確認 demo 機台存在於 MongoDB
- [x] 9.2 對真實運行的後端走一遍 `docs/design/event-flow.md` §3 的 `TEMPERATURE_REPORTED` 情境：`POST /simulator/events` → `GET /machines/:id` → `GET /machines/:id/events` → `GET /machines/:id/alerts`
- [x] 9.3 確認閾值內的對照案例（`event-flow.md` §4）：無狀態/健康分數變更，只有遙測更新
- [x] 9.4 確認嚴重度優先序的對照案例（`event-flow.md` §5）：手動把機台設為 `ERROR`、送一個超過閾值的 `TEMPERATURE_REPORTED` 事件，確認 `status` 維持 `ERROR` 而 `healthScore` 仍下降
