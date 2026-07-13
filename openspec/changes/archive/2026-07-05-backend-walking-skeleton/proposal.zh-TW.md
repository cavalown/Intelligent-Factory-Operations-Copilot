## 為什麼

設計階段已完成（架構、事件綱要、API 契約、機台領域模型、部署文件），但還沒有任何應用程式碼。在做完全部 5 種事件類型、前端與 AI 摘要之前，我們需要驗證核心架構假設 — 一條事件驅動管線，由獨立的 Kafka consumer 各自從同一個事件建立自己的投影 — 用真實程式碼、端到端地確實可行。本變更搭起 NestJS 後端的骨架，並用一種代表性事件類型（`TEMPERATURE_REPORTED`）證明完整管線，之後再擴展到其餘部分。

## 改什麼

- 依 `docs/design/architecture.md` §14.1 把 `backend/` 搭建為 NestJS 模組化單體：`events/`、`machines/`、`alerts/`、`insights/`、`simulator/`、`shared/` 模組資料夾。
- 實作 `POST /simulator/events`：接受完整組好的事件信封、驗證它，並以 `machineId` 為 key 發布到 `machine.events` Kafka topic（`docs/design/api.md` §4.7）。初期的 payload 驗證只涵蓋 `TEMPERATURE_REPORTED`。
- 實作 Event Service Kafka consumer：把事件不可變地持久化到 `machine_events`（`docs/design/architecture.md` §12.1）。
- 實作 Machine Service Kafka consumer：套用 `TEMPERATURE_REPORTED` 投影規則（status/healthScore/currentTemperature，依 `docs/design/machine-schema.md` §4/§5/§7）並維護 `machines` collection。
- 實作 Alert Service Kafka consumer：當回報溫度超過機台閾值時建立 `WARNING` 告警（依 `CLAUDE.md` / `docs/design/architecture.md` §9.3 的告警規則），並維護 `alerts` collection。
- 實作讀取端點：`GET /machines`、`GET /machines/:id`、`GET /machines/:id/events`、`GET /machines/:id/alerts`。
- 直接 seed 一小組固定的 demo 機台名單（依 `docs/design/machine-schema.md` §11：機台是預先 seed 的，不從未知 `machineId` 自動建立）。
- `backend/` 存在後，取消註解並對齊根 `docker-compose.yml` 中的 `backend` 服務區塊。

**本變更不在範圍內**（依約定的開發順序延到後續變更）：
- 其他 4 種事件類型（`STATUS_CHANGED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED`）。
- Insight Service / AI 摘要端點（`POST`/`GET /machines/:id/summary`）。
- 前端（本變更不搭建 `frontend/`）。

## 能力

### 新能力
- `machine-event-ingestion`：透過 REST 接受機台事件信封、依信封與 payload 綱要驗證，並發布到 Kafka 做非同步處理。初期範圍只涵蓋 `TEMPERATURE_REPORTED` payload。
- `event-history`：從 Kafka 消費機台事件並持久化為不可變、只增不改的歷史。
- `machine-state-projection`：從 Kafka 消費機台事件並維護每台機台的目前狀態（狀態、健康分數、最新遙測）作為透過 REST 曝露的讀取模型。
- `alert-detection`：從 Kafka 消費機台事件、套用嚴重度規則，並建立/透過 REST 曝露告警紀錄。

### 修改的能力
（無 — `openspec/specs/` 尚無既有規格）

## 影響

- 新的 `backend/` 目錄（NestJS 專案）。
- 根 `docker-compose.yml`：目前被註解掉的 `backend` 服務區塊被取消註解並接線。
- 開始使用的新 MongoDB collection：`machine_events`、`machines`、`alerts`。
- 使用 `machine.events` Kafka topic，先前已在本專案透過 Docker Compose（KRaft 模式、雙 listener）於本機驗證運行。
- `docs/` 設計文件不變 — 本變更實作它們已規格化的內容，縮限到一種事件類型。
- 無前端影響。
