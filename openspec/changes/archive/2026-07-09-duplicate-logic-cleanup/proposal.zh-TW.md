## 為什麼

發現可靠性 bug 的同一次 `/code-review`（見 `kafka-consumer-reliability-hardening`）也發現 4 個較低嚴重度的問題：一個真實的邊界情況 bug（`limit=0` 被無聲忽略）、兩處沒有共同真實來源的重複實作（Mongo duplicate-key 偵測；「STATUS_CHANGED 到 WARNING = 感測器故障」的分類，在 Machine Service 與 Alert Service 之間被發現以**相反的布林極性**重複），以及一個 walking-skeleton 階段遺留、如今已死的型別別名。這些今天都不會弄壞任何東西，但感測器故障的重複是真實的漂移風險 — 後續的探索工作階段（見 `docs/design/machine-schema.md` §5.4）結論是兩個服務應保持結構獨立（不建共用商業邏輯模組，符合 `ai/rules/module-boundaries.md`），但應該有一個**契約測試**，讓未來兩者之間的漂移大聲失敗而不是無聲發生。

**更新**：針對本變更自身實作（加上已歸檔的 `kafka-consumer-reliability-hardening`）的第二輪 `/code-review` 又發現 10 個 CONFIRMED 問題 — 包括本變更自己的 `limit=0` 修復引入的回歸，以及 `kafka-consumer-reliability-hardening` 的 `TEMPERATURE_REPORTED` 有限數值防護只套用到 Alert Service、沒有套用到 Machine Service 同一欄位的情況。這 10 個全部併入本變更的範圍（見下），而不是開第三個變更，因為它們是對本變更已在觸碰的程式碼的小型、直接相關修復。

## 改什麼

- `events.service.ts` 的 `listEvents()` 修復 `limit=0` 處理：`Number(query.limit) || DEFAULT_LIMIT` 因 JS falsy 強制轉換把明確的 `0` 當成「未提供」；改為明確的 `undefined` 檢查，讓 `limit=0` 被尊重（依現行行為截限到既有的 `[1, MAX_LIMIT]` 範圍，即 `limit=0` 變成 `limit=1`，而非無聲地變成 `limit=20`）。**第二輪修復**：只做 `undefined` 檢查引入了新回歸 — 非數字的 `limit`（例如 `?limit=abc`）現在會產生 `NaN` 而不是退回預設值；加上 `Number.isFinite` 檢查，讓兩個邊界情況都正確處理。
- `isDuplicateKeyError`（目前在 `event-consumer.service.ts` 與 `alert-consumer.service.ts` 逐字重複）移到一個共用 helper。
- 新的契約測試對一組共用 fixture 斷言 `MachineProjectionConsumerService` 與 `AlertConsumerService` 各自獨立的「這個 `STATUS_CHANGED` 事件是不是感測器故障」分類一致 — 不合併它們的實作（依 `machine-schema.md` §5.4 目前保持結構獨立的決策）。
- `IMPLEMENTED_EVENT_TYPES`/`ImplementedEventType`（因為全部 5 種事件類型都已實作，現與 `MVP_EVENT_TYPES`/`MvpEventType` 逐位元組相同）被刪除；`simulator.service.ts` 的唯一使用處直接改用 `MVP_EVENT_TYPES`。
- **第二輪新增**（來自第二次 code-review）：
  - `machine-projection-consumer.service.ts` 的 `TEMPERATURE_REPORTED` 情況獲得 `alert-consumer.service.ts` 已有的同一個 `Number.isFinite(temperature)` 防護 — 堵上 Machine Service 仍可能把 `Infinity`/`NaN` 寫進 `currentTemperature` 的缺口。
  - `simulator.service.ts` 的 `schemaVersion` 驗證從 `typeof !== 'number'` 改為 `Number.isFinite(...)`，因為 `typeof NaN`/`typeof Infinity` 都是 `'number'`、溜過了原本的檢查。
  - `alert-consumer.service.ts` 的 `resolveAlert` switch 加上記錄無法辨識 `eventType` 的 `default` 分支（呼應 `machine-projection-consumer.service.ts` 在 `kafka-consumer-reliability-hardening` 的對等分支），且其 `TEMPERATURE_REPORTED` 情況在跳過無效溫度時現在會記錄，堵上規格/程式碼不一致（規格早已寫「logged as skipped」；程式碼沒有記錄）。
  - `alert-consumer.service.ts` 對 `temperature` 的 `Number.isFinite` 檢查重排到 `machinesService.findRaw()` DB 呼叫之前而非之後，避免對格式錯誤的 payload 浪費一次查詢。
  - `KafkaConsumerBase` 現在擁有單一的 `protected readonly logger`，全部 3 個子類別經 `this.logger` 重用 — 移除 3 個重複的 `Logger` 實例化（每個子類別一個），它們各自帶著與基底類別自己的新 logger 相同的類別名脈絡。
  - 兩處引用 `openspec/changes/kafka-consumer-reliability-hardening/design.md` 的註解更新為歸檔後路徑（`openspec/changes/archive/2026-07-08-kafka-consumer-reliability-hardening/design.md`），因為該變更在這輪修復落地前已歸檔。
- **明確不變更**（已評估並保持原狀）：`KafkaConsumerBase` 的 catch-all 也吞掉暫時性基礎設施錯誤（不只是格式錯誤的訊息）是一個真實、獨立的設計問題 — 見 `design.md` 風險，等待使用者輸入而非被無聲地重新設計。Machine Service 與 Alert Service 之間重複（且無契約測試）的溫度閾值比較，已在 `machine-schema.md` §5.4 與感測器故障重複一起記載為接受的債務 — 這裡不採取新行動。

## 能力

### 新能力

（無）

### 修改的能力

- `event-history`：新需求：明確的 `limit=0` 被尊重（截限到最小值），而不是被無聲地當成「未提供 limit」。
- `machine-state-projection`：新需求：非有限的 `TEMPERATURE_REPORTED` 溫度不毀損 `currentTemperature`/`status`/`healthScore`。
- `alert-detection`：新需求：無法辨識的 `eventType` 不建立告警且被記錄。

## 影響

- **程式碼**：`backend/src/events/events.service.ts`、`backend/src/events/event-consumer.service.ts`、`backend/src/alerts/alert-consumer.service.ts`、`backend/src/machines/machine-projection-consumer.service.ts`、`backend/src/simulator/simulator.service.ts`、`backend/src/shared/kafka/kafka-consumer.base.ts`、`backend/src/shared/types/machine-event.types.ts`，加上新的共用 Mongo 錯誤工具與新的契約測試檔案。
- **行為變更**：`GET /events?limit=0` / `GET /machines/:id/events?limit=0` 現在回傳 1 筆而非預設 20 筆 — 輕微且可說更正確的 API 行為變更，預期不影響任何既有呼叫者，因為前端還不存在。`GET /events?limit=abc`（或類似非數字輸入）現在退回預設 20 筆，而不是產生 `NaN` 驅動的未定義查詢行為。
- **除了 `limit=0` 的釐清外沒有需要記載的 API 契約變更**，且那是對已記載行為的 bug 修復（`docs/design/api.md` §4.3/§4.4 已記載 `limit` 的預設/最大值；這不改變記載的契約，只是讓實作忠於它）。
- **文件**：`machine-schema.md` §5.4 已記錄促成本變更的探索工作階段；除上述規格 delta 外無進一步文件變更。
