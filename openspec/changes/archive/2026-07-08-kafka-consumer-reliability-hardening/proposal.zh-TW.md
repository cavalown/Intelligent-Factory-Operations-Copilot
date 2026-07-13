## 為什麼

一次針對整個後端實作的 `/code-review` 發現 6 個 CONFIRMED/PLAUSIBLE 正確性 bug，全部共享一個根因：3 個 Kafka consumer（Event/Machine/Alert Service）的訊息處理周圍都沒有任何錯誤邊界，而 simulator 的輸入驗證比下游 Mongoose schema 實際要求的更弱。單一格式錯誤或邊界情況的事件可能 (a) 永久崩潰一個 consumer — 因為 `eachMessage` 中未接住的錯誤阻止 Kafka offset 提交，kafkajs 會永遠重試同一則「poison pill」訊息，讓整個 consumer group 停擺 — 或 (b) 無聲地毀損已儲存資料（`NaN` 生產數量、含有字面文字「undefined」的告警訊息）。在前端開始依賴這些資料的可信度之前，必須修好。

## 改什麼

- `KafkaConsumerBase`（`backend/src/shared/kafka/kafka-consumer.base.ts`）把每個子類別的 `handleMessage` 呼叫包在 try/catch 裡：出錯時記錄並仍讓訊息視為已處理（不無限重試），而不是讓例外未接住地傳進 kafkajs。這是對全部 3 個 consumer 一次性修復「poison pill」失敗模式的共用修正。
- `SimulatorService` 把 `STATUS_CHANGED` 的 `payload.currentStatus` 對照 5 個允許的 `MachineStatus` 值驗證（不只是「是字串」），並驗證 `schemaVersion` 真的是數字（不只是「存在」）— 堵上讓無效資料進入 Kafka 的兩個具體缺口。
- `MachineProjectionConsumerService` 的事件類型 switch 加上 `default` 分支，對無法辨識的 `eventType` 完全跳過機台儲存，而不是無聲地落到最後的 `lastEventId`/`save()`、把未處理的事件標記為已處理。
- `MachineProjectionConsumerService` 的 `PRODUCTION_COMPLETED` 處理在套用前防護非數字的 `quantity`，而不是讓 `productionCount` 永久變成 `NaN`。
- `AlertConsumerService` 的 `TEMPERATURE_REPORTED` 處理在與閾值比較前防護缺失/非數字的 `temperature`，而不是建立訊息寫著「Temperature undefinedC exceeds warning threshold」的告警。

## 能力

### 新能力

- `kafka-consumer-resilience`：`KafkaConsumerBase` 與其 3 個子類別在 Kafka 訊息無法處理時的橫切行為 — 一個 consumer 訊息處理中的未處理錯誤不得阻止該 consumer group 繼續處理後續訊息。

### 修改的能力

- `machine-event-ingestion`：「拒絕未通過綱要驗證的 payload」需求對 `STATUS_CHANGED` 加強（必須是 5 個允許狀態之一，不只是字串），共用信封驗證也加強（`schemaVersion` 必須是數字，不只是存在）。
- `machine-state-projection`：新需求：(a) 跳過無法辨識的事件類型且不錯誤地標記為已處理；(b) `quantity` 缺失/無效時不毀損 `productionCount`。
- `alert-detection`：新需求：`TEMPERATURE_REPORTED` 的 `temperature` 缺失/無效時不建立格式錯誤的告警。

## 影響

- **程式碼**：`backend/src/shared/kafka/kafka-consumer.base.ts`、`backend/src/simulator/simulator.service.ts`、`backend/src/machines/machine-projection-consumer.service.ts`、`backend/src/alerts/alert-consumer.service.ts`。
- **行為變更**：今天，一則無效/格式錯誤的 Kafka 訊息可以無限期地崩潰整個 consumer group。本變更之後，它會被記錄並跳過。這是刻意的、適合 MVP 的選擇（記錄後跳過，無死信佇列）— 取捨見 `design.md`。
- **無 API 契約變更** — `docs/design/api.md` 不受影響；兩個新增/加強的驗證（`STATUS_CHANGED` enum、`schemaVersion` 型別）已落在那裡記載的既有 `422 PAYLOAD_VALIDATION_FAILED` / `400 INVALID_EVENT_ENVELOPE` 錯誤代碼之下。
- **文件**：除已寫定者外不需要 — 這是對 code review 發現的 bug 的純實作補課，不是需要另行記載的新設計決策。
