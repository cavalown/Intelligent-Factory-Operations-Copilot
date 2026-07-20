# Tasks: add-rule-engine

## 1. 基礎建設

- [x] 1.1 在 `env.config.ts` 加入 `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED`(預設 `machine.events.enriched`),依循既有的 `kafkaTopicMachineEvents` 樣式
- [x] 1.2 在 `backend/src/shared/types/machine-event.types.ts` 的 `MachineEventEnvelope` 加入 `temperatureExceedsThreshold?: boolean` 與 `isSensorFailure?: boolean`(design.md D3 —— envelope 層級的欄位,不加進任何 `payload` 介面)
- [x] 1.3 建立 `rules/` 模組(`rules.module.ts`),匯入 `MachinesModule` 以取得 `MachinesService.findRaw()`(module-boundaries.md —— 走匯出的服務,不要直接匯入 Machine model;`AlertConsumerService` 已經是這樣做,同一種樣式)

## 2. Rule Engine consumer/producer

- [x] 2.1 `RuleEngineConsumerService extends KafkaConsumerBase`,擁有自己的 consumer group `rules-service-group`,訂閱 `env.kafkaTopicMachineEvents`
- [x] 2.2 `handleMessage(event): Promise<boolean>`:對 `TEMPERATURE_REPORTED`,透過 `MachinesService.findRaw(event.machineId)` 查詢機台並設定 `temperatureExceedsThreshold`(找不到機台就完全省略這個欄位 —— spec 的「unknown machine passed through unclassified」情境);對 `STATUS_CHANGED`,從 `payload.currentStatus === 'WARNING'` 設定 `isSensorFailure`;對其他每個 `eventType`,兩個欄位都不加。**在 §6.1 修訂**:對非有限值的 `temperature` 也會跳過機台查詢並省略欄位。
- [x] 2.3 透過 `KafkaProducerService.publish(env.kafkaTopicMachineEventsEnriched, event.machineId, enrichedEvent)` 重新發布,保留原始每一個欄位包含 `eventId`(design.md D1/D2 —— 同一個 key,同一個 id)
- [x] 2.4 `handleMessage` 對每一則消費到的訊息都回傳 `true`。**在 §6.2 修訂**:對「無法分類」的兩種 no-op(未知機台、非有限值溫度)回傳 `false`,符合 `ai/rules/observability-conventions.md` 的字面規定;其他每種情況仍回傳 `true`,因為重新發布本身仍然是那些情況的真實效果。

## 3. 遷移 Machine Service 與 Alert Service

- [x] 3.1 `MachineProjectionConsumerService`:把它的 `super(...)` 呼叫改成訂閱 `env.kafkaTopicMachineEventsEnriched`,而不是 `env.kafkaTopicMachineEvents`
- [x] 3.2 `MachineProjectionConsumerService` 的 `TEMPERATURE_REPORTED` case:改讀 `event.temperatureExceedsThreshold`,而不是把 `payload.temperature` 拿去跟 `machine.temperatureThreshold` 比較
- [x] 3.3 `MachineProjectionConsumerService` 的 `STATUS_CHANGED` 健康分數 case:改讀 `event.isSensorFailure`,而不是呼叫 `isStatusChangedSensorFailure(currentStatus)`;刪除這個檔案裡現在已經死掉的那個函式
- [x] 3.4 `AlertConsumerService`:把它的 `super(...)` 呼叫改成訂閱 `env.kafkaTopicMachineEventsEnriched`
- [x] 3.5 `AlertConsumerService.resolveAlert` 的 `TEMPERATURE_REPORTED` 與 `STATUS_CHANGED` 分支:改讀 `event.temperatureExceedsThreshold` / `event.isSensorFailure`,而不是重新計算;也刪除這個檔案裡那份 `isStatusChangedSensorFailure` 的複本。`resolveAlert` 已經不需要 `MachinesService` 做這個查詢了,所以也把它從 constructor 移除,`resolveAlert` 也去掉了 async(已經不 await 任何東西)。
- [x] 3.6 刪除 `backend/src/shared/sensor-failure-contract.spec.ts`(design.md D6 —— 它比較的那兩個獨立實作已經不存在,沒有東西可以漂移了)

## 4. Compose + 登記表更新

- [x] 4.1 `docker-compose.yml`:不需要新服務(topic 會自動建立,跟 `machine.events` 已經是這樣一樣);在 `backend` 的 environment 區塊加入 `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED: machine.events.enriched`
- [x] 4.2 登記表 sweep(回顧報告 Pattern 3,這次刻意落實):把 `rules/` 加進 `docs/design/architecture.md` §14.1 與 `ai/rules/module-boundaries.md` 的模組清單(+ architecture.md 的 zh-TW 對照版);把 `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED` 加進 `docs/deployment/docker-compose.md` §5 環境變數登記表與 `docs/deployment/local-development.md` 的變數清單(兩者 + zh-TW);在新的 `docs/design/event-schema.md` §3.3 記錄富化後 envelope 的兩個新選填欄位(+ zh-TW);更新冷啟動競態註記裡的 consumer group 數量(3→4,+ zh-TW)
- [x] 4.3 確認沒有其他登記過的文件需要更新新成員(沒有新的 API 端點、沒有新的 Mongo collection —— Rule Engine 不擁有任何持久化、沒有新的錯誤碼)。比清單列的還多做了一步:`docs/design/observability.md`(+ zh-TW)原本把「三個 Kafka consumer」當成一個一般性的架構事實來描述(不只是歷史性的實例展示擷取畫面)—— 把這些敘述更新成四個,並在既有的實例展示上方加了一個標註日期的警語,說明它拍攝於本次變更加入這個 hop 之前,但沒有重寫已經擷取到的 trace 資料本身。

## 5. 驗證

- [x] 5.1 Demo 流程:透過 `POST /simulator/events` 為 `M-002` 發布一個 85°C(門檻 80)的 `TEMPERATURE_REPORTED` 事件。透過 `ifoc_events_processed_total{consumerGroup="rules-service-group"}`(在 `lgtm` 容器裡查 Prometheus)確認 Rule Engine 有處理它,而且 Machine Service(`healthScore` 34→24,`status` 保持 `WARNING`)與 Alert Service(建立了訊息為「Temperature 85C exceeds warning threshold.」的 alert)都只靠讀取富化欄位就正確反應。
- [x] 5.2 端到端驗證冪等性:把同一個 `eventId`(`evt_rule_engine_demo_001`)重新送過整條管線。`healthScore` 停在 24(沒有被重複扣減),而且這個 `eventId` 剛好只有一筆 alert —— 確認 design.md 的補償機制分析在加了 Rule Engine 這一個 hop 之後依然成立。
- [x] 5.3 驗證每機台保序在多了這個 hop 之後依然成立:為 `M-002` 連續快速送出 8 個 `TEMPERATURE_REPORTED` 事件(60→67°C);最終投影顯示 `currentTemperature: 67` 與 `lastEventId: evt_rule_engine_order_67` —— 是最後送出的那個事件,不是競態的結果。
- [x] 5.4 驗證未知機台的直通情境:直接對 `machine.events` topic 發布一個原始的 `TEMPERATURE_REPORTED` 事件,machineId 不存在(透過 `kafka-console-producer.sh` 繞過 HTTP API 自己的 `UNKNOWN_MACHINE` 防護)。透過 `kafka-console-consumer.sh` 查 `machine.events.enriched` 確認 Rule Engine 有把這個事件重新發布出去、省略了 `temperatureExceedsThreshold`(不是丟棄),整段期間 backend 程序沒有掛掉、沒有記錄任何錯誤,而且 `GET /machines/M-999-NOPE` 仍然正確回傳 `404 MACHINE_NOT_FOUND`(Machine/Alert Service 既有的未知機台略過邏輯沒被動到)。
- [x] 5.5 完整回歸測試:`npm run build`、`npm run lint`(0 個錯誤 —— 1 個既有、跟本次變更無關的 `main.ts` 警告)、`npm test`(47/47 通過,共 12 個 suite)全部乾淨;`openspec validate add-rule-engine --strict` 通過。

## 6. Code review 修正

一次高強度的 `/code-review`(8 個尋找角度,每個候選項一票驗證)找出 10 個確認/合理的 findings。全部 10 個都已修正:

- [x] 6.1 在 `RuleEngineConsumerService` 的 `TEMPERATURE_REPORTED` 分支加上 `Number.isFinite(temperature)` 防呆,跟下游兩個 consumer 已有的防呆一致 —— 非有限值的溫度現在會跳過機台查詢並重新發布未分類的版本(跟未知機台一樣的處理),而不是悄悄算出一個捏造的 `temperatureExceedsThreshold: false`。
- [x] 6.2 `handleMessage` 現在對「無法分類」的兩種 no-op(未知機台、非有限值溫度)回傳 `false`,而不是無條件回傳 `true`,對齊 `ai/rules/observability-conventions.md` 字面上列舉的 no-op 清單。這個修正沒有(也在結構上無法)關閉的殘留缺口 —— `rules-service-group` 的計數器在 Kafka 重新投遞時,仍可能對一個真的已經分類過的事件重複計數,因為 Rule Engine 不擁有任何持久化可以偵測重複 —— 現在已經在 `ai/rules/observability-conventions.md` 與這份文件的風險章節裡明確記載為一個接受的例外,而不是留成一個無聲的不一致。
- [x] 6.3 新增 `backend/src/rules/rule-engine-consumer.service.spec.ts` —— 直接對分類邏輯做單元測試覆蓋(溫度高於/低於/非有限值門檻、未知機台、STATUS_CHANGED 的 WARNING/非 WARNING、無關的事件類型、eventId/key 保留),這是 design.md 自己的風險章節要求作為被刪除的契約測試的替代品、但先前還沒真的寫出來的測試覆蓋。
- [x] 6.4 把 `temperatureExceedsThreshold`/`isSensorFailure` 限定範圍在 `TemperatureReportedEvent`/`StatusChangedEvent`(透過交集型別),而不是加在共用的 `MachineEventEnvelope` 基底上,讓型別系統現在會拒絕在錯誤的 `eventType` 上讀寫分類欄位 —— 跟 `payload` 已經有的保護一致。
- [x] 6.5 更新 `docs/design/machine-schema.md` §5.4(+ zh-TW),反映它記錄的那個重複問題現在已經被本次變更解決,而不是繼續描述一個還沒解決的問題,以及一個已經不存在的契約測試。
- [x] 6.6 為本次變更目錄底下全部六個 artifact(`proposal.md`、`design.md`、`tasks.md`,以及三個 `specs/*/spec.md`)新增 `.zh-TW.md` 對照版,依 `ai/rules/bilingual-docs.md` 明確的範圍(`docs/`、`openspec/`……)以及本 repo 自己的先例(`add-observability` 已封存的 artifact 全部都有對照版)。
- [x] 6.7 把 `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED` 加進 `backend/.env.example`,這個在原本 §4 的登記表 sweep 裡漏掉了。
- [x] 6.8 修正 `machine-status-transitions.spec.ts` 裡過時的 `TEMPERATURE_REPORTED` fixture —— 移除已經失效的 `temperatureThreshold: 80` mock 欄位,讓「門檻內」測試明確設定 `temperatureExceedsThreshold: false`,而不是依賴這個欄位剛好是 `undefined`,並新增一個練習 `temperatureExceedsThreshold: true` 的新測試(狀態升級/健康分數下降的分支,遷移後先前沒有測試覆蓋)。
- [x] 6.9 把 consumer group 從 `rule-engine-group` 改名為 `rules-service-group`,以符合其他三個 consumer 遵循的 `<module>-service-group` 樣式,依 `ai/rules/kafka-consumer-conventions.md`。已經在程式碼、文件,以及兩份 zh-TW 對照版裡一併調整。
- [x] 6.10 把 Mongo I/O / 序列化的取捨(每個 `TEMPERATURE_REPORTED` 事件的讀取次數沒有淨減少;Machine/Alert Service 的處理現在被串接在 Rule Engine 後面,而不是像以前一樣並行)明確記錄成 design.md 裡一個接受的風險項目,而不是完全沒提到。
