# 機台綱要（Machine Schema）

## 1. 目的

本文件定義 `machines` collection — Machine Service 從 `machine_events` 建立的目前狀態投影（見 `docs/design/event-schema.md`）。

`machine_events` 回答「發生了什麼？」，`machines` 則回答「這台機台現在的狀態是什麼？」本文件規定欄位、狀態模型、健康分數規則，以及進來的事件如何被套用來更新機台文件。

---

## 2. Profile 欄位 vs. Projection 欄位

機台文件有兩種欄位：

* **Profile 欄位** — 身分與設定。機台註冊時設定，不從事件推導。
* **Projection 欄位** — 目前狀態，完全由依序套用 `machine_events` 推導而來。

```text
Profile fields:      machineId, name, temperatureThreshold
Projection fields:   status, healthScore, currentTemperature, productionCount, lastEventId, lastUpdatedAt
```

這個區分之所以重要只有一個原因：projection 欄位永遠可以從頭重播 `machine_events` 重建（見 `architecture.md` §10.4，事件重播流程）。Profile 欄位不行 — 它們完全沒有出現在事件流中，因為沒有任何 MVP 事件 payload 攜帶機台的顯示名稱或溫度閾值。

---

## 3. 欄位定義

| 欄位 | 型別 | 種類 | 說明 |
| --- | --- | --- | --- |
| `machineId` | string | Profile | 唯一機台識別碼，例如 `M-001`。 |
| `name` | string | Profile | 人類可讀的顯示名稱。 |
| `temperatureThreshold` | number | Profile | 每台機台的警告閾值（°C）。見 §6。 |
| `status` | string | Projection | `RUNNING`、`IDLE`、`WARNING`、`ERROR`、`MAINTENANCE` 之一。見 §4。 |
| `healthScore` | number | Projection | `0`–`100`。見 §5。 |
| `currentTemperature` | number \| null | Projection | 最新回報的溫度。第一個 `TEMPERATURE_REPORTED` 事件前為 `null`。 |
| `productionCount` | number | Projection | 由 `PRODUCTION_COMPLETED` 事件累計的數量。 |
| `lastEventId` | string \| null | Projection | 最近一次套用到本文件的事件的 `eventId`。 |
| `lastUpdatedAt` | string \| null | Projection | 最近一次套用到本文件的事件的 `producedAt`。 |

---

## 4. 狀態模型

狀態圖原始檔（完整涵蓋 §4.2–§4.3，包括被阻擋轉移的自迴圈）：[`docs/assets/mermaid/machine-status-state.mmd`](../assets/mermaid/machine-status-state.mmd)。

### 4.1 允許的狀態

| 狀態 | 意義 |
| --- | --- |
| `RUNNING` | 機台正在積極生產。正常。 |
| `IDLE` | 機台已通電但未生產（待機、換線、班次之間）。正常。 |
| `WARNING` | 偵測到輕微問題（例如溫度超過閾值）。需要注意。 |
| `ERROR` | 機台回報錯誤狀況（例如緊急停止）。需要注意。 |
| `MAINTENANCE` | 機台需要維護或檢查。需要注意。 |

`RUNNING` 與 `IDLE` 都是正常運轉狀態 — 唯一的差別是機台目前是否在生產。`WARNING`、`ERROR` 與 `MAINTENANCE` 是應該引起操作員注意的問題狀態，這也是 §4.2 把它們排在 `RUNNING`/`IDLE` 之上的原因。

這與 `STATUS_CHANGED` 的 `payload.currentStatus` 使用的是同樣五個狀態（`event-schema.md` §5.1）。

### 4.2 嚴重度優先序

機台事件獨立抵達，可能隱含互相衝突的狀態（例如已在 `ERROR` 的機台之後回報一個正常範圍的溫度）。為了避免低嚴重度事件無聲地清除高嚴重度問題，每個狀態有一個嚴重度等級：

| 狀態 | 等級 |
| --- | --- |
| `ERROR` | 4（最高） |
| `MAINTENANCE` | 3 |
| `WARNING` | 2 |
| `RUNNING` | 1 |
| `IDLE` | 1 |

**規則：事件只能提升或維持狀態，絕不能無聲地降低它。** 事件隱含的狀態只有在其等級大於或等於目前狀態的等級時，才能覆寫 `machine.status`。

唯一的例外是 `STATUS_CHANGED`。它的 `payload.currentStatus` 是關於機台狀態的明確、權威事實 — 不是推論 — 所以它永遠覆寫 `machine.status`，不管等級。這是 MVP 中唯一能把機台從 `ERROR` 或 `MAINTENANCE` 移回 `RUNNING`/`IDLE` 的機制；沒有自動復原。

### 4.3 事件 → 狀態對應

| 事件類型 | 隱含狀態 | 適用時機 |
| --- | --- | --- |
| `STATUS_CHANGED` | `payload.currentStatus` | 一律（明確覆寫，繞過 §4.2 排序）。 |
| `TEMPERATURE_REPORTED` | `WARNING` | 僅當 `payload.temperature > machine.temperatureThreshold`。否則沒有狀態意涵 — 只更新 `currentTemperature`。 |
| `ERROR_OCCURRED` | `ERROR` | 一律。 |
| `MAINTENANCE_REQUIRED` | `MAINTENANCE` | 一律。 |
| `PRODUCTION_COMPLETED` | `RUNNING` | 一律（受 §4.2 約束 — 不會把既有的 `ERROR`/`MAINTENANCE`/`WARNING` 降級）。 |

---

## 5. 健康分數規則

### 5.1 上下界

`healthScore` 限制在 `0`–`100`。新註冊的機台從 `100` 開始。MVP 沒有隨時間自動復原 — 分數只因事件而改變，且永遠不會超出 `[0, 100]`：

```text
healthScore = clamp(healthScore + delta, 0, 100)
```

### 5.2 各事件的增減

| 事件 | 條件 | 健康分數增減 |
| --- | --- | --- |
| `TEMPERATURE_REPORTED` | `payload.temperature > temperatureThreshold` | `-10` |
| `TEMPERATURE_REPORTED` | 閾值內 | `0`（無增減） |
| `ERROR_OCCURRED` | — | `-30` |
| `MAINTENANCE_REQUIRED` | — | `-20` |
| `STATUS_CHANGED` | `currentStatus == WARNING` | `-15` |
| `STATUS_CHANGED` | 其他任何 `currentStatus` | `0`（無增減） |
| `PRODUCTION_COMPLETED` | — | `+2` |

這與 `CLAUDE.md` 的機台狀態規則表一致。`STATUS_CHANGED` / `WARNING` 那一列與「其餘無增減」那一列是本文件的延伸，之所以需要，是因為 `STATUS_CHANGED` 是通用事件，而 CLAUDE.md 只為它的感測器故障情況定義了增減。**MVP 規則**：任何把 `currentStatus` 設為 `WARNING` 的 `STATUS_CHANGED` 事件都視為感測器故障情況 — 不另行檢查 `payload.reason` 的文字，因為 `reason` 是自由格式，而 MVP 範圍內也沒有定義其他轉移到 `WARNING` 的 `STATUS_CHANGED`。

**健康分數增減與 §4.2 的狀態排序規則彼此獨立。** `PRODUCTION_COMPLETED` 事件永遠套用 `+2`，即使機台目前在 `ERROR`、該事件不被允許降級其狀態。狀態與健康分數是由各自規則更新的獨立欄位。

### 5.3 MVP：寫死，不可設定

§5.2 的增減值與 §4.2 的嚴重度等級在 MVP 中寫死在 Machine Service 邏輯裡 — 不是資料庫欄位、設定值或管理者可編輯的設定。這是刻意的：`docs/product/mvp.md` 明確把 Rule Engine 排除在 MVP 範圍外。

`docs/product/product-roadmap.md` Phase 2（Event Streaming）把「Rule Engine」列為功能。實作該階段時，這些特定值 — 五個健康分數增減與五個狀態嚴重度等級 — 就是應該從程式碼移到外部可設定規則資料的具體規則。任何開始 Phase 2 的人都應把本段當成「先外部化什麼」的清單。

### 5.4 已解決：詮釋邏輯在 consumer 之間重複

**狀態：已被 `openspec/changes/add-rule-engine` 解決。** 本節原本記錄的是一個 MVP 階段接受的風險（Machine Service 與 Alert Service 各自獨立重新推導同一分類）以及一個過渡期緩解措施（契約測試）。兩者現在都已成為歷史 — 下方描述的、作為最終解法的 Rule Engine 已經上線，讓它變得多餘的那個契約測試也已被刪除。保留本節是為了記錄 Rule Engine *為什麼*存在；目前的架構請見 `openspec/changes/add-rule-engine/design.md`。

因為 §4.3/§5.2 的規則曾經是每個服務各自寫死（§5.3）而非只計算一次，對於效果有條件的那兩種事件類型，Machine Service 與 Alert Service 各自獨立地從同一個原始事件重新推導同樣的分類：「`TEMPERATURE_REPORTED` 的 `temperature` 是否超過 `temperatureThreshold`？」以及「`STATUS_CHANGED` 的 `currentStatus` 是否表示感測器故障（即等於 `WARNING`）？」兩個服務曾經得到相同結論，但沒有任何結構性保證它們保持同步 — 一次 code review 就抓到其中一例漂移成兩服務間相反的布林邏輯（`machine-projection-consumer.service.ts` 檢查 `currentStatus === 'WARNING'`，`alert-consumer.service.ts` 檢查 `currentStatus !== 'WARNING'`）。

這曾與 ML 基礎設施團隊所說的 **training-serving skew** 是同一類問題 — 兩個系統各自從同一原始輸入重新推導同一特徵，因為衍生值沒有單一真實來源而逐漸漂移。規模化下的標準解法（Feature Store 或 Kafka Streams/ksqlDB 富化拓撲存在的目的）是：把衍生事實計算一次、發布出去，讓每個 consumer 讀同一個計算結果而不是重新推導。**現在系統就是這樣運作的**：一個 Rule Engine（`backend/src/rules/`）訂閱原始的 `machine.events` topic，計算一次這兩個分類，並附加衍生欄位後重新發布到 `machine.events.enriched`；Machine Service 與 Alert Service 現在訂閱這個富化後的 topic,只負責讀取分類結果,不再重新推導。

在這上線之前,`ai/rules/module-boundaries.md` 禁止把商業邏輯放進 `shared/` 的規則,意味著這個重複不能靠抽出共用函式來修 — 那會悄悄打開這條規則正要防止的那個洞,所以過渡期的緩解是一個**契約測試**(一組共用的事件 fixture,對兩個服務各自獨立的分類邏輯做斷言)。這個契約測試現在已經被刪除:只剩下 Rule Engine 這一個實作,已經沒有兩個獨立的東西可以拿來比較了。

---

## 6. 每台機台的溫度閾值

`temperatureThreshold` 是 profile 欄位，不從事件推導 — `event-schema.md` §5.2 明確把閾值排除在原始 `TEMPERATURE_REPORTED` payload 之外，所以它必須放在機台文件上。

* 機台註冊／seed 時設定。
* 不被任何 MVP 事件或 API 端點修改（`api.md` 中不存在閾值更新端點）。
* MVP 預設建議：未指定的機台為 `80`（°C）。此預設值是占位 — 實作前確認真實值。

---

## 7. 投影更新演算法

Machine Service 一次套用一個事件，順序為 Kafka 對特定 `machineId` 分割區的遞送順序：

```text
function applyEvent(machine, event):
    switch event.eventType:

        STATUS_CHANGED:
            machine.status = event.payload.currentStatus
            if event.payload.currentStatus == "WARNING":
                machine.healthScore = clamp(machine.healthScore - 15)

        TEMPERATURE_REPORTED:
            machine.currentTemperature = event.payload.temperature
            if event.payload.temperature > machine.temperatureThreshold:
                machine.status = raiseSeverity(machine.status, "WARNING")
                machine.healthScore = clamp(machine.healthScore - 10)

        ERROR_OCCURRED:
            machine.status = raiseSeverity(machine.status, "ERROR")
            machine.healthScore = clamp(machine.healthScore - 30)

        MAINTENANCE_REQUIRED:
            machine.status = raiseSeverity(machine.status, "MAINTENANCE")
            machine.healthScore = clamp(machine.healthScore - 20)

        PRODUCTION_COMPLETED:
            machine.productionCount += event.payload.quantity
            machine.status = raiseSeverity(machine.status, "RUNNING")
            machine.healthScore = clamp(machine.healthScore + 2)

    machine.lastEventId = event.eventId
    machine.lastUpdatedAt = event.producedAt
    return machine

function raiseSeverity(currentStatus, impliedStatus):
    return impliedStatus if rank(impliedStatus) >= rank(currentStatus) else currentStatus

function clamp(value, min = 0, max = 100):
    return max(min, min(max, value))
```

這是示意，不是實作規格 — 它展示綱要要求更新邏輯做什麼，而不是 Machine Service 的 NestJS 程式碼該如何組織。

---

## 8. 冪等性

依 `CLAUDE.md` 設計規則 4，consumer 必須用 `eventId` 防範重複事件處理。

機台文件上的 `lastEventId` 識別最近套用的事件，但它本身只能防止*緊接在前的*事件被套用兩次 — 無法偵測較舊事件的亂序重送。完整的重複防護（例如查 `machine_events` 檢查是否已處理過，或 consumer 層級的去重儲存）是後端實作的考量，不在本綱要文件範圍內。

### 8.1 狀態寫入契約

任何會變更機台 `status` 並持久化的程式路徑，必須同時記錄一筆 `machine_status_transitions`（from/to 狀態、事件 `occurredAt`、`eventId`）— 24 小時稼働率計算完全由該投影推導，繞過的寫入會無聲地毀損它。目前投影 consumer 的 `recordTransitionIfChanged` 是唯一的狀態寫入者；若未來新增路徑（例如 Phase 2 的告警確認工作流程或手動覆寫端點），要嘛讓它經過同一個記錄 helper，要嘛先把狀態指派重構為單一擁有者方法。見 `openspec/changes/dashboard-operational-metrics/design.md` D10。

---

## 9. 機台文件範例

```json
{
  "machineId": "M-001",
  "name": "CNC Mill 01",
  "temperatureThreshold": 80,
  "status": "WARNING",
  "healthScore": 78,
  "currentTemperature": 95,
  "productionCount": 142,
  "lastEventId": "evt_temp_001",
  "lastUpdatedAt": "2026-07-02T10:30:01.000Z"
}
```

這與 `docs/design/api.md` §5.1 中 `GET /machines` 與 `GET /machines/:id` 回傳的機台物件形狀一致 — API 模型就是直接讀這份文件，沒有額外轉換。

---

## 10. 與其他 Collection 的關係

```text
machines.machineId        <- machine_events.machineId   (one machine has many events)
machines.lastEventId      -> machine_events.eventId      (pointer to most recent applied event)
machines.machineId        <- alerts.machineId            (one machine has many alerts)
machines.machineId        <- ai_summaries.machineId       (one machine has many summaries)
```

`machines` 永遠不儲存事件或告警歷史的反正規化副本 — 那些直接從 `machine_events` 與 `alerts` 查詢。機台文件上唯一保留的交叉參照是 `lastEventId`，用於追溯與除錯。

---

## 11. 機台註冊與預設值

1. **機台註冊是預先 seed 的，不是自動建立的。** 在任何引用其 `machineId` 的事件抵達之前，機台文件必須已存在（透過 seed 腳本或固定的 demo 名單）。未知 `machineId` 的事件會被拒絕 — 見 `docs/design/api.md` §4.7 與 §6，錯誤代碼 `UNKNOWN_MACHINE`。它不被當成隱含的「建立這台機台」訊號。
2. **初始狀態為 `IDLE`。** 新 seed 的機台尚未收到任何證明它在生產的事件，所以從休止狀態開始，符合 `event-schema.md` 的 `STATUS_CHANGED` 範例使用的 `previousStatus: "IDLE"` 慣例。
3. 未在 seed 時指定的機台，**`temperatureThreshold` 預設為 `80`°C**。
