## 背景

`docs/design/machine-schema.md` §5.4 記錄了 MVP 每服務分類方式的一個已接受但有風險的後果:Machine Service 與 Alert Service 各自獨立地從同一個原始事件重新推導兩個條件事實 ——「`TEMPERATURE_REPORTED` 的 `temperature` 是否超過 `temperatureThreshold`?」以及「`STATUS_CHANGED` 的 `currentStatus` 是否表示感測器故障?」一次 code review 已經抓到這兩個獨立推導漂移(兩服務間相反的布林邏輯)。過渡期的緩解是一個契約測試,對照共用 fixture 斷言兩服務的邏輯保持同步 —— 這是安全網,不是修法,而且明確標記為暫時性、等待 Phase 2。`architecture.md` §9.3 直接點名了修法:「未來版本可以用一個 rule engine 取代簡單的、寫死在程式碼裡的邏輯。」

使用者已經決定(2026-07-20)採用富化拓撲(enrichment-topology)的形狀:一個新的 Kafka topic,讓 Machine Service 與 Alert Service 改訂閱它,而不是把 Rule Engine 插進同步的 API 發布路徑裡。

## 目標 / 非目標

**目標:**

- 只有一個地方計算 `TEMPERATURE_REPORTED` 超過門檻與 `STATUS_CHANGED` 是否感測器故障;Machine Service 與 Alert Service 讀取答案,不再各自重新推導。
- 保留兩個服務目前依賴的每一個既有保證:每 `machineId` 的事件保序(`event-schema.md` §8)、`eventId` 鍵控的冪等性(`machine-schema.md` §8),以及 `machine.events` 自身 append-only「每個事件只記錄一次」的語意(`architecture.md` §9.1)—— Event Service 繼續直接訂閱原始 `machine.events`,不受本次變更影響。
- 一旦兩個服務都讀取同一個計算結果,就讓過渡期的契約測試退役 —— 已經沒有東西可以獨立漂移。

**非目標:**

- 一個通用、可設定、或使用者可撰寫的規則 DSL。本次變更修的是 `machine-schema.md` §5.4 點名的兩個具體、已經漂移過的條件式 —— 不是一個規則引擎*產品*。如果未來出現第三個分類需求,可以另開一個變更來通用化;為了樣本數只有兩個就強行抽象是過早的。
- 對 `machine.events` 本身、API 合約、Insight Service,或 dashboard 讀到的東西做任何變更。這是既有 Kafka consumer 之間的內部管線變更。
- 在 Kafka 自己的重播(`fromBeginning: true`)以外做歷史資料的回填或遷移 —— 見遷移計畫。

## 決策

### D1:一個新 topic `machine.events.enriched`,以 `machineId` 為鍵 —— 跟 `machine.events` 同一個分區鍵

Rule Engine 訂閱 `machine.events`(依 `ai/rules/kafka-consumer-conventions.md`,擁有自己的 consumer group),並重新發布到 `machine.events.enriched`,發布時使用跟來源事件**同一個 `machineId` 鍵**。這讓 `event-schema.md` §8 的每機台保序保證端到端地保留下來:因為分區鍵沒變,Kafka 的每分區保序在重新發布之後仍然成立,所以 Machine/Alert Service 依然會依照事件發生的順序看到每台機台的事件,只是晚了一個 hop。一個新的環境變數 `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED`(預設 `machine.events.enriched`),依循 `env.config.ts`/`docker-compose.md` §5 裡既有的 `KAFKA_TOPIC_MACHINE_EVENTS` 樣式 —— 由 Kafka 既有的 `KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"` 自動建立,不需要新的基礎設施步驟。

### D2:重新發布的事件保留原本的 `eventId` —— 它是更豐富的副本,不是新事件

富化事件帶著來源 `MachineEventEnvelope` 的每一個欄位,原封不動,加上新的分類欄位(D3),都在**同一個 `eventId`** 底下。這是刻意且是承重的設計:Machine Service 跟 Alert Service 既有的冪等性保護(`lastEventId` 比較、duplicate-key 攔截 —— `machine-schema.md` §8)都是以 `eventId` 為鍵,而且兩個服務都已經假設「一個 `eventId`,一個決定」。在重新發布時鑄造一個新的 `eventId` 會悄悄打壞這個系統已經依賴的每一個下游冪等性檢查。Rule Engine 自己對 `machine.events` 的消費,本身也跟其他每個 consumer 一樣是冪等的(逐分區 offset commit;一個被重新投遞的來源事件只會再次重新發布同一個富化事件,下游的冪等性會把它當成 no-op 吸收掉)。

### D3:分類欄位是新的頂層 envelope 欄位,不是加進 `payload` 裡

`temperatureExceedsThreshold?: boolean` 與 `isSensorFailure?: boolean` 被加成 envelope(`MachineEventEnvelope`)上 `correlationId` 的手足欄位,各自只在跟該事件的 `eventType` 相關時才出現(這模仿了 `correlationId` 本身也是選填的做法)。它們**不會**被加進特定型別的 `payload` 介面(`TemperatureReportedPayload`、`StatusChangedPayload`)—— `payload` 保持原始 producer 送出的樣子,直接穿透、不被碰,所以 `event-schema.md` §5 的 payload 合約形狀不變,Event Service 儲存的原始歷史(它從來看不到這些欄位,因為它訂閱的是 `machine.events` 而不是富化後的 topic)也不需要任何綱要變更。

*程式碼審查後修訂(§6.4)*:這兩個欄位實際實作時被限定範圍在 `TemperatureReportedEvent`/`StatusChangedEvent`(透過交集型別),而不是加在共用的 `MachineEventEnvelope` 基底介面上 —— 這樣型別系統就能拒絕在錯誤的 `eventType` 上讀寫分類欄位,跟 `payload` 已經有的保護一致。

### D4:Rule Engine 是一個新 `rules/` 模組裡的 `KafkaConsumerBase` 子類別

依 `ai/rules/module-boundaries.md`,這個邏輯不能放在 `shared/`(禁止商業邏輯),也不特別屬於 `machines/` 或 `alerts/`,因為它必須在兩者的上游、獨立於兩者被計算。一個新的 `rules/` 模組(在同一次變更裡把它加進 `architecture.md` §14.1 跟 `module-boundaries.md` 的模組清單 —— 依 observability 回顧報告 Pattern 3 的教訓,做登記表 sweep)擁有它。繼承 `KafkaConsumerBase`(而不是手刻一個 consumer,依 `ai/rules/observability-conventions.md`)代表 Rule Engine 免費拿到自己的 consumer group、`isDataError` 分類的錯誤處理,以及 —— 免費附送 —— `ifoc.correlation_id`/`event_id`/`event_type` span 屬性,還有 `rules-service-group` 標籤下的 `ifoc.events.processed` 計數,不用多寫任何程式碼。

### D5:Machine Service 與 Alert Service 完全改訂閱 `machine.events.enriched`;Event Service 不變

Machine Service 與 Alert Service 的 `super(kafka, '<group>', env.kafkaTopicMachineEvents)` 呼叫改成 `env.kafkaTopicMachineEventsEnriched`。Event Service 繼續原封不動地訂閱原始 `machine.events` —— 它逐字儲存歷史,沒有需要修的分類邏輯。這代表 Machine/Alert Service 的新鮮度現在受 Rule Engine 自己的 consumer lag 限制,不只是 Kafka 的(見風險)。

### D6:過渡期的契約測試在兩個服務都遷移完後刪除,不是留著當多餘的檢查

一旦 Machine Service 跟 Alert Service 都改成從富化事件讀取 `temperatureExceedsThreshold`/`isSensorFailure` 而不是自己算,就已經沒有兩個獨立實作可以讓契約測試比較了 —— 留著它就等於斷言一個恆真式(兩個服務讀同一個欄位永遠會一致)。它的工作完全被 Rule Engine 自己分類邏輯得到的任何測試覆蓋吸收。

## 風險 / 取捨

### Rule Engine 故障時的資料安全與完整性 —— 本設計依賴的補償機制

本設計本身沒有新增任何安全機制;它依賴這個系統已經有的三個保證,用既有三個 consumer 已經在用的同樣方式組合起來:

1. **Kafka 的持久化日誌 + 已提交的 offset**:Rule Engine 崩潰後重啟會從最後提交的 offset 繼續 —— 不會跳過任何事件,也不需要手動重播任何事件。這跟 Event/Machine/Alert Service 現有的重啟復原方式完全一樣。
2. **`eventId` 鍵控的冪等性,端到端(D2)**:Kafka 的傳遞保證是 at-least-once,所以 Rule Engine *會*偶爾重新處理並重新發布同一個來源事件超過一次(例如處理完跟 offset commit 之間發生崩潰)。因為重新發布的事件保留原本的 `eventId`(D2),Machine/Alert Service 既有的冪等性保護(`lastEventId` 比較、duplicate-key 攔截)會把重複吸收成 no-op —— 這才是「中途故障時會發生什麼」的真正答案:重複是靠設計本身安全,不是靠運氣。
3. **既有的 `isDataError` 毒丸(poison-pill)分類**:一個讓 Rule Engine 自己的分類邏輯拋出例外的來源事件,會被當成跟其他任何 consumer 的壞訊息情況一模一樣處理 —— 資料錯誤會被記錄並跳過(那一個事件永遠不會有富化後的對應版本,跟其他三個 consumer 已經接受的取捨一樣),暫時性錯誤則會被重新拋出給 kafkajs 自己的重試機制。

淨效果:〔Rule Engine 掛掉或落後〕→ Machine/Alert Service 就只是看不到新事件,直到它追上為止;一旦追上,不會遺失也不會重複計算任何東西。Event Service 完全不受影響,因為它不訂閱富化後的 topic。

**重用既有保證沒蓋到的唯一缺口**:`docker-compose.yml` 沒有設定明確的 Kafka retention,所以套用 broker 的預設值(168 小時 / 7 天)。如果 Rule Engine 掛掉的時間超過這個值又沒人注意到,最舊的未處理 `machine.events` 訊息可能在 Rule Engine 追上之前就過期了。這個曝險在今天對其他三個 consumer 同樣存在 —— 不是本次變更新引入的 —— 在這個專案的 demo 規模下不值得用額外的機制去緩解;寫在這裡是為了誠實,不是行動項目。

- 〔多一個 Kafka hop 會在事件發生跟 Machine/Alert Service 看到之間增加延遲〕→ 在這個專案的 demo 規模下可以忽略不計(跟 observability 已經建立的同一種「demo 量級」定位一致);不是這裡值得優化的問題。
- 〔契約測試退役移除了一個安全網〕→ 它防範的風險(兩個獨立實作悄悄漂移)已經被結構性地消除,不只是沒測試 —— 現在只剩一個實作。它的替代品是對 Rule Engine 自己分類邏輯的直接測試覆蓋,在 `backend/src/rules/rule-engine-consumer.service.spec.ts`。
- 〔未來第三個分類需求會重新打開「共用邏輯」這個問題〕→ 刻意延後處理(非目標),而不是投機性地先解決;等它是真實需求而非假設性需求時,Rule Engine 的模組邊界就是自然而然該加進去的地方。
- 〔`rules-service-group` 的 `ifoc.events.processed` 計數在重新投遞時可能重複計算〕→ Rule Engine 不擁有任何持久化(module-boundaries.md),所以跟其他三個 consumer 不同,它沒有 `lastEventId`/duplicate-key 這種狀態可以偵測一個被重新投遞的來源事件並跳過重複計數。在發布富化事件跟提交來源 offset 之間發生崩潰,會讓已經計算過一次的事件的計數器再增加一次。這是接受的取捨,而不是用新增狀態來修 —— 因為單純為了讓一個 metric 去重就加持久化,會跟這個模組存在的理由本身矛盾(`ai/rules/observability-conventions.md` 明確記載了這個 Rule Engine 的例外)。
- 〔`TEMPERATURE_REPORTED` 事件的 MongoDB 讀取沒有淨減少〕→ Rule Engine 的 `findRaw` 查詢(上方 D1)取代的是 Alert Service 原本的查詢,而不是消除它 —— Machine Service 仍然自己單獨做一次 `findOne` 來更新投影。針對同一台機台文件、每個事件的總讀取數維持在 2 次不變;改變的是 Machine/Alert Service 的處理現在被串接在 Rule Engine 的消費-分類-發布步驟後面,而不是像本次變更之前那樣彼此並行處理。在這個專案的 demo 規模下,跟上面的延遲一樣接受這個取捨 —— 不當成正確性問題處理,因為這裡沒有任何東西打壞 D1/D2 所依賴的保證。

## 遷移計畫

1. 新增 `rules/` 模組、`machine.events.enriched` topic/環境變數,以及 Rule Engine 的 `KafkaConsumerBase` 子類別(訂閱 `machine.events`,重新發布富化事件)。
2. 把 Machine Service 與 Alert Service 改成訂閱 `machine.events.enriched` 而不是 `machine.events`,改讀新欄位而不是自己算。
3. 移除過渡期的契約測試。
4. 不需要資料遷移:所有 consumer 已經在用 `fromBeginning: true`,在全新部署時會重播完整的 topic 歷史(既有樣式,`kafka-consumer-conventions.md`)。第一次開機時,Rule Engine 會自己從頭重播整個 `machine.events`,把 `machine.events.enriched` 完整補齊,才會被 Machine/Alert Service 自己的重播追上 —— 跟這個系統裡其他每個 consumer 已經在用的開機方式一致。

回滾:把 Machine Service 與 Alert Service 改回直接訂閱 `machine.events`,搭配它們原本內建的分類邏輯(從版本控制還原被刪除的程式碼);富化後的 topic 跟 Rule Engine 模組可以放著不用或移除。不論哪個方向都沒有破壞性步驟 —— Kafka topic 是新增性質,不是原地遷移。

## 未解決的問題

沒有阻塞性的 —— 唯一延後的問題(未來第三個分類需求是否終究值得一個更通用的規則機制)明確被排除在範圍外(非目標),直到它是一個真實、當下的需求為止。
