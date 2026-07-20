## 為什麼

Machine Service 跟 Alert Service 各自獨立地從同一個原始 `machine.events` 重新推導同樣的兩個條件式分類 ——「`TEMPERATURE_REPORTED` 的 `temperature` 是否超過 `temperatureThreshold`?」以及「`STATUS_CHANGED` 的 `currentStatus` 是否表示感測器故障?」—— 兩者都沒有單一真實來源。這已經在實務上漂移過一次:一次 code review 抓到兩個服務的布林檢查彼此相反(`machine-projection-consumer.service.ts` 檢查 `currentStatus === 'WARNING'`,`alert-consumer.service.ts` 檢查 `currentStatus !== 'WARNING'`)。過渡期的緩解是一個契約測試,斷言兩個服務各自獨立的邏輯保持同步 —— 這是安全網,不是修法。`docs/design/machine-schema.md` §5.4 與 `docs/design/architecture.md` §9.3 都明確指出這正是 Phase 2 的 Rule Engine 應該解決的問題,而 Phase 2(Event Streaming)正是目前路線圖所在的階段。

## 有哪些變更

- **新的 Rule Engine consumer/producer**:一個富化(enrichment)consumer,讀取原始 `machine.events`,對每個事件只計算一次衍生分類(先從已知重複的那兩個條件式開始),然後重新發布一個帶有原始 envelope 加上衍生分類欄位的富化事件。
- Machine Service 與 Alert Service **停止各自獨立重新推導** `TEMPERATURE_REPORTED` 超過門檻與 `STATUS_CHANGED` 是否為感測器故障 —— 改成從富化事件讀取已經算好的分類。
- 一旦兩個服務都讀取同一個計算結果,過渡期的契約測試(對兩個服務各自獨立分類邏輯做斷言的共用 fixture)就**退役** —— 已經沒有東西可以獨立推導,也就沒有東西可以漂移。
- 為 Rule Engine 新增一個模組(module-boundaries.md 禁止把商業邏輯放進 `shared/`,而這個邏輯也不特別屬於 `machines/` 或 `alerts/`,因為它必須在兩者的上游、獨立於兩者被計算)。

本次變更範圍之外:把 Rule Engine 擴展到目前已存在且已經漂移過的這兩種分類以外的新分類類型(例如一個通用、可設定的規則 DSL)—— 本次變更修的是已命名、具體的重複問題;一個通用的規則撰寫系統是另一個更大範圍的決定,design doc 應該點出但不在這裡承諾。

## Capabilities

### 新增 Capabilities
- `rule-engine`:富化 consumer/producer —— 讀取原始機台事件、計算衍生分類、重新發布富化事件;擁有「衍生分類的單一真實來源」這個保證。

### 修改 Capabilities
- `machine-state-projection`:Machine Service 的 `TEMPERATURE_REPORTED` 超過門檻與 `STATUS_CHANGED` 是否感測器故障的處理方式,從各自計算分類改成從富化事件讀取。
- `alert-detection`:Alert Service 同樣的兩個條件式以同樣的方式改變。

## 影響

- **程式碼**:新的 Rule Engine 模組(Kafka consumer + producer),`machine-projection-consumer.service.ts` 與 `alert-consumer.service.ts` 的變更(讀取富化欄位而非自行計算),兩個服務都遷移完後移除過渡期的契約測試。
- **Kafka**:一個承載富化事件的新 topic(或等效機制 —— 由 design doc 決定);`machine.events` 本身不受影響(append-only、每個事件只記錄一次,依 `architecture.md` §9.1)。
- **事件綱要**:富化事件的形狀(原始 envelope + 衍生分類欄位)需要一份文件化的合約,可能放在 `docs/design/event-schema.md` 或一個新的專屬章節。
- 不預期有 **API 合約變更** —— 這是內部管線變更;Machine/Alert 投影對外的形狀(dashboard 讀到的東西)不變。
