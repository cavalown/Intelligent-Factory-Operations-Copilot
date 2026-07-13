## 脈絡

`backend-walking-skeleton` 變更為一種事件類型（`TEMPERATURE_REPORTED`）建好了完整管線，並透過 `SimulatorService` 明確的 `UNSUPPORTED_EVENT_TYPE` 拒絕與縮限的 `IMPLEMENTED_EVENT_TYPES` 常數，刻意延後其他 4 種 MVP 事件類型。全部 5 種事件類型的規則早已在 `docs/design/event-schema.md` §5/§9.2、`docs/design/machine-schema.md` §4.3/§5.2/§7 與 `docs/design/architecture.md` §9.3 完整規格化 — 本變更是對既有、無歧義規格的純實作，僅有一個缺口在下方解決。

## 目標 / 非目標

**目標：**
- 為 `STATUS_CHANGED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED` 實作 simulator 驗證、Kafka 發布與全部 3 個 consumer（Event/Machine/Alert Service）。
- 重用 walking skeleton 已證明的完全相同架構（原始 `kafkajs`、`KafkaConsumerBase` 子類別、`ApiError`、模組邊界規則）— 不引入新模式。
- 實作 `STATUS_CHANGED` 的嚴重度優先序例外（唯一被允許降級 `machine.status` 的事件類型）。

**非目標：**
- 不新增 REST 端點、不改 schema/collection、不做前端（另行追蹤）。
- 不為新的增減值做 Rule Engine / 外部化設定 — 依 `machine-schema.md` §5.3，這些在 MVP 維持寫死在 Machine/Alert Service 程式碼中，與既有的 `TEMPERATURE_REPORTED` 閾值增減完全一樣。
- 除了擴大接受的 `eventType` 集合外，不改 `event-history` consumer 邏輯（持久化本來就與信封形狀無關）。

## 決策

### 1. `STATUS_CHANGED` 的感測器故障偵測（解決一個未記載的缺口）

`machine-schema.md` §7 的虛擬碼呼叫 `isSensorFailure(event.payload.reason)` 卻從未定義它，而 `payload.reason` 是自由格式的人類可讀字串、沒有 enum — 所以不存在可靠的文字比對規則。

**決策：把每個 `payload.currentStatus == "WARNING"` 的 `STATUS_CHANGED` 事件都視為感測器故障情況。** 不對 `payload.reason` 做文字檢查。因此 `isSensorFailure()` 不實作為獨立函式 — 條件塌縮為對 `currentStatus` 的直接檢查。

理由（使用者確認）：MVP 範圍內，`STATUS_CHANGED` 沒有其他被定義的理由會明確把機台設為 `WARNING` — `TEMPERATURE_REPORTED` 是通往 `WARNING` 的唯一其他路徑，且它不經過這段程式。曾考慮對自由格式文字做關鍵字比對，因脆弱而否決（會漏掉像「vibration threshold exceeded」這種不含「sensor」字樣的說法）。

這表示：
- `STATUS_CHANGED` → `currentStatus: WARNING`：`healthScore -15`，建立 WARNING 告警。
- `STATUS_CHANGED` → 其他任何 `currentStatus`：`healthScore` 不變，不建立告警。

### 2. `STATUS_CHANGED` 完全繞過嚴重度優先序

依 `machine-schema.md` §4.2，`STATUS_CHANGED` 一律以 `payload.currentStatus` 覆寫 `machine.status`，不論目前等級 — 這是 MVP 唯一的降級路徑（例如操作員/simulator 明確把機台從 `ERROR` 移回 `RUNNING`）。所有其他事件類型繼續走 `raiseSeverity()`（只有隱含狀態的等級 >= 目前等級才覆寫）。

### 3. `productionCount` 以 `payload.quantity` 遞增，不是固定 `+1`

`machine-schema.md` §7 虛擬碼：`machine.productionCount += event.payload.quantity`。`quantity` 是 `PRODUCTION_COMPLETED` 的必填欄位（`event-schema.md` §9.2）。

### 4. 各事件類型的告警規則（依 `architecture.md` §9.3）

| 事件類型 | 建立告警？ | Severity |
| --- | --- | --- |
| `STATUS_CHANGED` | 只有 `currentStatus == WARNING` 時（決策 1） | `WARNING` |
| `ERROR_OCCURRED` | 一律 | `CRITICAL`（不論 `payload.recoverable`） |
| `MAINTENANCE_REQUIRED` | 一律 | `WARNING` |
| `PRODUCTION_COMPLETED` | 永不 | — |

### 5. 原樣重用既有的冪等性與模組邊界模式

- 全部 3 個 consumer 保持既有的冪等性機制（`machine_events`/`alerts` 上 `eventId` 的唯一索引、duplicate-key 即 no-op；`machines` 比對 `lastEventId`）— 不需要新的冪等邏輯，因為它本來就與類型無關。
- `MachineProjectionConsumerService` 與 `AlertConsumerService` 繼續依賴 `MachinesService`（不直接依賴 Mongoose model），依 `ai/rules/module-boundaries.md`。

## 風險 / 取捨

- **[風險] 「任何 WARNING 都是感測器故障」規則（決策 1）可能無法泛化**：若未來非 MVP 的 `STATUS_CHANGED` producer 因不相關原因（例如手動操作員註記）設定 `currentStatus: WARNING`。→ **緩解**：在 `machine-schema.md` 更新中明確記載為 MVP 專用的啟發式；標記為 `payload.reason` 若在後期階段變成結構化（例如 `reasonCode` enum）時第一個要重新檢視的事項。
- **[風險] `ERROR_OCCURRED` 的 `payload.recoverable` 欄位目前未被任何規則使用**（健康分數、狀態與告警嚴重度不論其值皆為常數）。→ **緩解**：這與既有的成文規則完全一致（`architecture.md` 第 427 行確認刻意不對 `recoverable` 做區分）；不需行動，只是註明它不是疏漏留下的死程式碼。

## 遷移計畫

無資料遷移。純加法：既有的 `TEMPERATURE_REPORTED` 行為不變；4 種新事件類型只是不再於 simulator 邊界被拒絕。以正常的後端重建部署（`docker compose up -d --build backend`）。

## 未決問題

無 — 唯一識別出的缺口（感測器故障偵測）已在上方決策 1 解決。
