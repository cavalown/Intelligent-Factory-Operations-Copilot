# Observability（可觀測性）

## 1. 目的

本文件描述 IFOC 的可觀測性子系統 —— OpenTelemetry traces/metrics、`nestjs-pino` 結構化日誌,以及 `lgtm`(Grafana + Loki + Tempo + Prometheus,全部包在一個容器裡)的 demo 堆疊 —— 在 Phase 1.1(`docs/product/product-roadmap.md`)加入。內容涵蓋:哪些東西被 instrument 了、關聯機制怎麼運作、怎麼在 Grafana 裡讀懂這些訊號,以及控制這一切的環境變數。

實作決策與理由記載在 `openspec/changes/add-observability/design.md`;本文件是使用與理解這個子系統的長期參考,不是「為什麼這樣做」的紀錄。

---

## 2. 哪些東西被 Instrument 了

一切都透過 `@opentelemetry/auto-instrumentations-node` 自動完成,在 `backend/src/instrumentation.ts` 啟動 —— 這是 `backend/src/main.ts` 最先 import 的東西,搶在 Nest、Express、Mongoose、kafkajs 之前(auto-instrumentation 會在 require 當下 patch 這些模組,所以必須最先執行)。

| 訊號 | 來源 | 涵蓋範圍 |
| --- | --- | --- |
| Traces | `instrumentation-http`、`instrumentation-express`、`instrumentation-mongoose`、`instrumentation-kafkajs`、`instrumentation-nestjs-core` | 每個 HTTP 請求、每個 Mongo 操作、每次 Kafka produce/consume —— 包含透過 Kafka 訊息 header 的 W3C trace-context 傳遞,所以一條 trace 可以貫穿一次 HTTP 請求、Kafka publish,以及三個 consumer 各自的處理。 |
| Logs | `instrumentation-pino`(同一個套件內建) | 在一個 span 是 active 的期間,把 `trace_id`/`span_id`/`trace_flags` 注入每一筆 pino log record,並把 pino log record 轉送進 OTel logs pipeline —— 兩者都是自動的;這次沒有為此寫任何手動的 mixin 或 transport。 |
| Metrics | Auto-instrumentation(HTTP/Mongoose/kafkajs 的預設 metric)+ 一個自訂 counter | `ifoc.events.processed`(§4)是唯一一個應用層定義的 metric。 |

整個程式碼庫裡沒有任何手動 span —— 上面這組 auto-instrumentation 涵蓋了這個專案需要的每一種情況。為什麼這樣選,見 `openspec/changes/add-observability/design.md` D1;至於一小段手刻管線邏輯(URL 組合)如何違反了這個原則又悄悄溜回來、後來又被修正的案例,見 `docs/retrospectives/2026-07-observability-review-lessons.md` 模式 3。

---

## 3. 關聯機制:傳輸層身分 vs. 領域身分

每個事件都帶著兩個各自獨立的識別碼,彼此不互相取代:

- **`trace_id`/`span_id`**(W3C trace context)回答的是「哪些 span 屬於這次請求」—— 由 OTel 指派,透過 HTTP header 跟 Kafka 訊息 header 自動傳遞,出現在每一行 log 跟每一個 span 上。
- **`correlationId`**(事件 envelope 的欄位,`docs/design/event-schema.md` §3)回答的是「這是哪一條業務流程」—— 由 producer 指派,跟事件一起存起來,而且能在重播/重新投遞時存活下來,這是 trace ID 做不到的(一則被重新投遞的訊息會拿到一條*新的* trace,但*相同的* `correlationId`)。

三個 Kafka consumer 各自的處理 span 都帶著 `ifoc.correlation_id`、`ifoc.event_id`、`ifoc.event_type` 這三個 span 屬性(只在 `KafkaConsumerBase` 設定一次,三個 consumer 子類別共用,沒有各自重複)。這讓你可以直接用 `correlationId` 去查 Tempo,找到某個業務事件產生的那條確切 trace,即使 trace 本身的 ID 從來沒有暴露給事件的 producer。

---

## 4. `ifoc.events.processed` 計數器

標籤:`eventType`(事件的 `eventType` 欄位)與 `consumerGroup`(`event-service-group` / `machine-service-group` / `alert-service-group`)。

**語意:**每個 consumer group 各自遞增一次,而且只有在該 consumer 的 `handleMessage` 真正產生效果時才遞增 —— 新建一筆文件、更新了投影、建立了 alert。對於刻意的 no-op —— 無法辨識的 `eventType`、重新投遞/重複的 `eventId`、對應到不明 `machineId` 的事件,或者(對 alert consumer 來說)不需要建立 alert 的事件 —— **不會**遞增。`handleMessage` 的抽象簽章之所以回傳 `Promise<boolean>`,正是為了這個原因 —— 只有真正產生效果才是 `true` —— 因為這個 metric 早期的版本把上面這些情況全都誤計為「已處理」(完整經過與為什麼這是個值得指名的陷阱,見 `docs/retrospectives/2026-07-observability-review-lessons.md` 模式 2)。

實際上:三個 consumer group 會各自處理每一則訊息(各自有獨立的訂閱 —— `ai/rules/kafka-consumer-conventions.md`),所以一個事件視各個 consumer 實際對它做了什麼,可能合理地讓三個 group counter 中的 0、1、2 或 3 個遞增。一個超過門檻的 `TEMPERATURE_REPORTED` 事件會讓三個都遞增(存了歷史、更新了投影、建立了 alert);同樣事件型別但溫度在門檻以下,則只會讓兩個遞增(存了歷史、更新了投影 —— 沒有 alert)。

---

## 5. Fail-Soft 行為

不論 `lgtm` 容器存不存在、連不連得到、有沒有在跑,平台的行為都必須一模一樣(`design.md` D5)。具體來說:

- OTLP exporter(traces、metrics、logs)在匯出失敗時會緩衝後丟棄 —— 一個壞掉或不存在的 collector 不會產生任何客戶端可見的錯誤、不會 crash、也不會卡住任何請求。
- `docker-compose.yml` 的 `backend` 服務**沒有** `depends_on` `lgtm` —— 一次失敗或很慢的 `lgtm` image pull 永遠不會卡住 `backend` 的啟動(這一行為什麼刻意*沒有*加進去,見 `docs/retrospectives/2026-07-observability-review-lessons.md` 模式 4)。
- `OTEL_SDK_DISABLED=true` 是一個硬性的開關,在 SDK 被建構之前,`instrumentation.ts` 就會明確檢查它。

---

## 6. 環境變數

完整的登記表見 `docs/deployment/docker-compose.md` §5。對這個子系統來說特別重要的兩個:

- `OTEL_SERVICE_NAME`(預設 `ifoc-backend`)—— 在 `env.config.ts` 裡明確讀取,並當成 `serviceName` 傳入,因為 OTel SDK 不會像處理 endpoint 那樣自動從環境偵測這個值。
- `OTEL_EXPORTER_OTLP_ENDPOINT` —— 刻意**不**透過 `env.config.ts` 讀取。每個 OTLP exporter 都會照 OTel 規格自己的 fallback 順序,直接從 `process.env` 解析出這個值(以及任何訊號別的覆寫,例如 `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`)。`instrumentation.ts` 早期的版本用一個從 `env.config.ts` 讀來的單一數值手動組出 exporter URL,結果悄悄讓訊號別的覆寫失效 —— 見 `docs/retrospectives/2026-07-observability-review-lessons.md` 模式 3。

---

## 7. 在 Grafana 裡怎麼看

`docker compose up -d` 會連 `lgtm` 一起啟動。Grafana 在 **http://localhost:3001**(backend 已經佔用主機的 `:3000`)。

**Traces(Tempo):** Explore → Tempo。用 tag 搜尋 —— `ifoc.correlation_id=<值>` 可以直接找到某個業務事件產生的確切 trace,完全不需要先知道它的 `trace_id`。如果手上已經有一個 `trace_id`(例如從一行 log 拿到的),也可以直接貼上去查。

**Logs(Loki):** Explore → Loki。`{service_name="ifoc-backend"}` 查全部;加上 `| trace_id="<值>"` 可以直接跳到某次請求的 log 行。只要進入一個 active span,每一筆 log record 都會把 `trace_id`/`span_id` 帶成 structured metadata(不只是寫在訊息內文裡)。

**Metrics(Prometheus):** Explore → Prometheus。`ifoc_events_processed_total`(OTel 的 `ifoc.events.processed` 依 Prometheus 的命名慣例會變成這個名字 —— 點變底線,counter 加上 `_total` 後綴)。

**在三者之間跳轉:**一行帶 `trace_id` 的 Loki log 會有一個「Trace: ...」的 derived-field 連結,直接連到對應的 Tempo trace —— 這個連結就是 `docs/deployment/docker-compose.md` 裡 Loki datasource 的 provisioning(`derivedFields`)設定出來的。

---

## 8. 實際案例

一次真實的 `POST /simulator/events`,`TEMPERATURE_REPORTED` 事件、溫度 88°C(超過 `M-001` 的 80°C 門檻)、`correlationId: "corr_demo_show_..."`:

**存取日誌**(`docker logs ifoc-backend`,Loki 裡也是同一筆):
```json
{
  "level": 30,
  "req": { "method": "POST", "url": "/api/simulator/events" },
  "trace_id": "0c99c2f55e0cb22d9006f3858891c88d",
  "span_id": "3277f07b44342ca4",
  "trace_flags": "01",
  "res": { "statusCode": 202 },
  "responseTime": 35,
  "msg": "request completed"
}
```

**Tempo 裡的 trace**(用 `ifoc.correlation_id=corr_demo_show_...` 搜尋找到,`trace_id` 跟上面同一個),節錄重要的 span:
```text
POST /api/simulator/events
  mongodb.find / mongoose.Machine.findOne   (查詢門檻值)
  send machine.events                        (Kafka producer)
  process machine.events  ← ifoc.correlation_id=corr_demo_show_...   (event-service-group:儲存歷史)
  process machine.events  ← ifoc.correlation_id=corr_demo_show_...   (machine-service-group:更新投影)
  process machine.events  ← ifoc.correlation_id=corr_demo_show_...   (alert-service-group:建立 alert)
  mongoose.MachineEvent.save
  mongoose.Machine.save
  mongoose.Alert.save
```

**Metric**(`ifoc_events_processed_total`,篩選這個 backend instance),這一個事件前後的變化:
```text
event-service-group    3 → 4
machine-service-group  3 → 4
alert-service-group    1 → 2   (這次事件超過門檻 —— 建立了一筆 alert)
```

對照組:同樣事件型別但溫度*低於*門檻,會讓 `event-service-group` 跟 `machine-service-group` 遞增,但**不會**讓 `alert-service-group` 遞增(§4)—— `resolveAlert` 回傳 null,`handleMessage` 回傳 `false`,不會設定屬性也不會觸發 counter。

---

## 9. 規則出處

| 關注點 | 來源 |
| --- | --- |
| 為什麼是這些設計選擇(auto-instrumentation、pino 接線、`lgtm` 容器、fail-soft) | `openspec/changes/add-observability/design.md` |
| Compose 服務定義、環境變數登記表 | `docs/deployment/docker-compose.md` §3、§5 |
| Kafka consumer group 慣例 | `ai/rules/kafka-consumer-conventions.md` |
| 事件 envelope 欄位(`correlationId`、`eventId`、`eventType`) | `docs/design/event-schema.md` §3 |
| 建置這個子系統時犯的錯,以及為什麼 | `docs/retrospectives/2026-07-observability-review-lessons.md` |
