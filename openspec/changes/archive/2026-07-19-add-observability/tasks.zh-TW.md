# 任務：add-observability

## 1. OTel 啟動

- [x] 1.1 加入 OTel 依賴（`@opentelemetry/sdk-node`、`auto-instrumentations-node`、OTLP exporter）與 `backend/src/instrumentation.ts`（NodeSDK 初始化、服務名稱、來自環境變數的 OTLP 端點、尊重 `OTEL_SDK_DISABLED`），在 `main.ts` 中最先 import
- [x] 1.2 環境變數：`OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` / `OTEL_SDK_DISABLED` 加入 `env.config.ts`，遵循純 `process.env` 模式
- [x] 1.3 驗證（不是假設 — 回顧紀錄模式 4）exporter 的 fail-soft：在沒有任何 collector 可連、以及 `OTEL_SDK_DISABLED=true` 時後端都乾淨啟動 — 2026-07-19 驗證:在有真實 Kafka/MongoDB、但沒有 `lgtm` 容器運行的情況下,本機執行編譯後的後端(乾淨啟動、HTTP 請求正常回應),以及 `OTEL_SDK_DISABLED=true` 時再測一次(結果相同)

## 2. 結構化日誌

- [x] 2.1 把 `nestjs-pino` 接為 Nest logger（`app.useLogger`）；JSON 輸出到 stdout；確認既有 14 個 `Logger` 呼叫點仍然輸出 — 已驗證:完整的 Nest 啟動/路由對應 log 串流現在都透過 `nestjs-pino` facade 以 pino JSON 形式輸出
- [x] 2.2 透過 pino mixin 在每行日誌注入 `trace_id`/`span_id`；日誌經 OTel logs 管線送到 Loki（記載的 fallback：若 Node log signal 不穩就只輸出 stdout JSON）— 改用 `@opentelemetry/instrumentation-pino`(`auto-instrumentations-node` 內建,由任務 1.1 啟用)實作,而非手寫 mixin:它會 patch pino,在有 active span 時把 `trace_id`/`span_id`/`trace_flags` 注入每筆 log,並把 log 轉送進同一條 OTel logs pipeline,所以不需要另外寫 mixin/transport 程式碼(design.md D1 的「auto-instrumentation 優於手刻」理由同樣適用於這裡)。已驗證:一筆存取日誌帶有來自真實請求的 `trace_id`/`span_id`。
- [x] 2.3 透過 nestjs-pino 的請求日誌做 HTTP 存取日誌（方法、路徑、狀態、時長）；確認一個強制的 5xx 同時出現在存取日誌與帶錯誤的 trace span — 存取日誌(method/url/statusCode/responseTime)已透過一次真實請求驗證(200)。5xx 標記 span 為錯誤的行為是用原始碼驗證,而非假設(回顧紀錄模式 4):`@opentelemetry/instrumentation-http` 的 `http.js:505` 透過 `parseResponseStatus(SpanKind.SERVER, statusCode)` 設定 incoming-request span 的狀態,而 `utils.js:54-63` 定義該函式在非 CLIENT 的 span kind(SERVER 的 upperBound 為 500)下,任何 `statusCode >= 500` 都回傳 `SpanStatusCode.ERROR`。曾嘗試一次即時的強制 500 復現(執行中把 MongoDB 停掉),但撞上 Mongoose 預設 30 秒的 `serverSelectionTimeoutMS` 緩衝而非快速失敗;上述原始碼層級的驗證被接受為足夠的替代方案(2026-07-19 code review 修正 — 見 §6)。

## 3. 領域關聯 + metric

- [x] 3.1 在三個 consumer 的訊息處理中加入 `ifoc.correlation_id` / `ifoc.event_id` / `ifoc.event_type` span 屬性與日誌欄位 — 統一實作在 `KafkaConsumerBase`(三個 consumer 子類別共用),而非各自重複
- [x] 3.2 加入 `ifoc.events.processed` 計數器（標籤：eventType、consumer group），在每個 consumer 成功處理時遞增 — 同樣統一放在 `KafkaConsumerBase`

## 4. Compose + 文件

- [x] 4.1 在 docker-compose.yml 加入 `lgtm` 服務（`grafana/otel-lgtm`）— Grafana 在 `:3001`、OTLP `:4318`；後端取得 `OTEL_EXPORTER_OTLP_ENDPOINT=http://lgtm:4318`
- [x] 4.2 更新 `docs/deployment/docker-compose.md`：服務表（§2）+ §5 註冊表中所有 `OTEL_*` 環境變數 — 同時同步了 §3 內嵌的 yaml(原本就跟實際檔案有落差)以及 §1/§6 的文字說明;並同步到 zh-TW 對照版
- [x] 4.3 註冊表掃描（回顧紀錄模式 3）：確認沒有其他列舉式文件需要新成員（沒有新模組、沒有新 collection、沒有新錯誤代碼、沒有 API 變更）— 透過一次研究性檢查掃描過;更新了 `docs/design/architecture.md` §6/§13.1(+ zh-TW 對照版)、`ai/context/technology-stack.md`,以及 `docs/assets/mermaid/deployment-topology.mmd`,加上 `lgtm` 服務。確認 `ai/rules/module-boundaries.md`(instrumentation.ts 是 Nest 啟動前的檔案,不是模組)、API/端點註冊表、Mongo collection 註冊表都不需要變更。

## 5. 驗證

- [x] 5.1 堆疊運行時的 demo 流程：simulator POST → Tempo 中一條橫跨 HTTP + producer + 三個 consumer 的 trace，帶 correlationId 屬性；Loki 中帶 trace_id 的存取日誌；Prometheus 中的 events-processed metric — 全部透過 Grafana — 2026-07-19 針對真實的 Docker Compose 堆疊驗證(`docker compose build backend && docker compose up -d`):發送一個帶已知 `correlationId` 的 `TEMPERATURE_REPORTED` 事件,查詢 Grafana 的 datasource proxy API:Tempo 的 `/api/search?tags=ifoc.correlation_id=...` 找到該 trace(36 個 span:HTTP server + middleware、Kafka producer `send machine.events`、三個 `process machine.events` consumer span,各自帶有 `ifoc.correlation_id`/`ifoc.event_id`/`ifoc.event_type`,以及它們各自的 Mongo span);該 trace ID 與 Loki 中找到的 HTTP 存取日誌的 `trace_id` 相符(`{service_name="ifoc-backend"} | trace_id="..."`);Prometheus 的 `ifoc_events_processed_total` 顯示三個 consumer group 依 `eventType` 標籤各自為 1
- [x] 5.2 `lgtm` 停止時的 demo 流程：完整的 API + 前端行為完全相同、無客戶端可見錯誤、後端日誌透過 `docker logs` 仍是可讀的 JSON — 已驗證:`ifoc-lgtm` 停止時,GET `/api/machines`/`/api/dashboard/stats`/`/api/alerts` 都是 200,新的 simulator POST 回傳 202 且完整投影完成(機台的 `currentTemperature` 有更新),前端在 `:5173` 仍正常提供服務,後端容器維持運行沒有重啟,`docker logs` 持續顯示可讀的 JSON 存取日誌

## 6. Code review 修正（2026-07-19 review，high effort，8 角度 finder + verify pass，7 個發現全數處理）

- [x] 6.1 `recordProcessed` 可能 null-deref:一則 Kafka 訊息若內容是字面上的 `null` 這 4 個位元組,會被成功解析(`JSON.parse('null') === null`),後續的 `envelope.correlationId` 存取就會丟出 `isDataError` 辨識不出來的 `TypeError`,進而落入 kafkajs 的重試路徑,而不是被吞掉 —— 對一則注定會一直失敗的訊息而言等於卡死。從根本修正:把 envelope 解析搬進 `KafkaConsumerBase.onModuleInit` 本身(只解析一次,在呼叫 `handleMessage` 之前),並明確檢查 `parsed === null || typeof parsed !== 'object'`,不符合就丟出 `SyntaxError`(會被正確歸類為 data error),而不是讓一次錯誤的型別轉換之後才丟出 `TypeError`。
- [x] 6.2 `ifoc.events.processed` 把「handleMessage 沒有丟出例外」當成「已處理」,導致三個 consumer 裡 5 種不同的非拋出型跳過路徑(不明 eventType、兩處 duplicate-key 冪等 no-op、找不到 machineId、eventId 已套用過、不需要建立 alert)都被誤計為成功 —— 其中一個還悄悄地在新的一層重新違反了一份已封存的 spec 要求(「不要標記為已處理」)。修正:`handleMessage` 的抽象簽章從 `Promise<void>` 改為 `Promise<boolean>`;每個子類別只在真正產生效果時回傳 `true`,每個跳過路徑回傳 `false`;`KafkaConsumerBase` 只在 `true` 時才呼叫 `recordProcessed`。
- [x] 6.3 `recordProcessed` 自己的 `JSON.parse` 重新解析了每個子類別 `handleMessage` 早就解析過的同一個 Kafka 訊息 buffer,而它本地的 `EventEnvelopeIdentity` interface 也和既有的 `MachineEventEnvelope` type 有部分重複。透過 6.1/6.2 同一次重構修正:base class 只解析一次,把已具型別的 `MachineEvent` 傳給 `handleMessage`,後者不再自己解析;`EventEnvelopeIdentity` 已刪除。
- [x] 6.4 `backend` 的 `depends_on` 原本包含 `lgtm`,導致全新一次 `docker compose up` 若 `otel-lgtm` image pull 失敗或很慢,會連帶卡住 `backend` 完全無法啟動 —— 這跟「optional/fail-soft」的說法在「第一次啟動」這個情境上互相矛盾(已實際重現:沒有 health condition 的 `depends_on` 仍然要求依賴的容器先「啟動」,dependent 服務才會啟動)。修正:把 `lgtm` 從 `backend` 的 `depends_on` 中整個移除 —— 它從來就不是執行期正確性所需要的(OTLP 匯出不論啟動順序都是 fail-soft),頂多只在啟動順序上有用,而這點順序性不值得付出這樣的耦合代價。
- [x] 6.5 `instrumentation.ts` 手寫的 `otlpUrl` helper 總是把明確的 `url`傳給所有三個 OTLP exporter,這(已對照 `@opentelemetry/otlp-exporter-base` 原始碼驗證)會永久停用 SDK 自己對訊號別 endpoint 環境變數的解析(`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` 等設定會被悄悄忽略)。修正:不再對任何 exporter 傳入 `url`;各自依照 OTel 規格自己的 fallback 順序,從環境變數解析出自己的 endpoint。`env.config.ts` 中因此變成沒人使用的 `otelExporterOtlpEndpoint` 欄位也一併移除。
- [x] 6.6 這份檔案自己的任務 2.3 打勾標記完成,但註記裡明明承認所要求的情境沒有被實際重現,違反 `ai/rules/testing.md`「標記任務完成前至少要驗證每個 spec 情境」的規定。修正:上方任務 2.3 現在引用了驗證 5xx 會標記 span 為錯誤這個行為的確切 `@opentelemetry/instrumentation-http` 原始碼行號,取代原本沒有重現成功的即時測試。
- [x] 6.7 `tasks.zh-TW.md` 一直沒有跟著這份檔案更新,導致它顯示全部 13 項任務都還沒開始,而這份檔案卻顯示整個 change 已經完成 —— 違反本專案的雙語文件慣例(每個已封存的 change 都讓這兩份檔案的打勾狀態保持同步)。修正:`tasks.zh-TW.md` 已與這份檔案完全同步。
