# observability 規格（delta）

## 新增的需求

### 需求：一條 trace 橫跨一個請求與它觸發的 consumer 工作
系統 SHALL 把 W3C trace context 從 HTTP 請求經 Kafka 訊息 header 傳播到每個 consumer，讓單一 trace 包含 simulator POST、Kafka 發布，以及每個 consumer 的處理 span。

#### 情境：simulator 事件的 trace 跨越 Kafka
- **WHEN** 可觀測性堆疊運行時，客戶端 POST `/simulator/events`
- **THEN** 存在一條 trace，包含 HTTP server span、Kafka producer span，以及 event、machine、alert 三個 consumer group 的處理 span

#### 情境：consumer 的 span 帶著領域身分
- **WHEN** consumer 處理一個事件
- **THEN** 它的 span 以屬性形式帶著事件的 `correlationId`、`eventId` 與 `eventType`（領域身分與 trace 身分並存）

### 需求：日誌是帶 trace 關聯的結構化 JSON
系統 SHALL 把所有後端日誌以結構化 JSON 輸出到 stdout；請求範圍的行 SHALL 包含作用中的 `trace_id`，consumer 處理的行 SHALL 包含事件的 `correlationId`。既有的 `Logger` 呼叫點透過 Nest logger 門面繼續運作。

#### 情境：請求日誌帶 trace id
- **WHEN** 任何 HTTP 請求被處理
- **THEN** 輸出一行存取日誌（方法、路徑、狀態、時長），為包含該請求 `trace_id` 的 JSON

#### 情境：500 永不隱形
- **WHEN** API 請求產生 5xx 回應
- **THEN** 存取日誌記錄它，且對應的 trace 把該 span 標記為錯誤

### 需求：已處理的事件以 metric 計數
系統 SHALL 在 consumer 每次完成處理一個事件時，遞增以 `eventType` 與 consumer group 為標籤的 `ifoc.events.processed` 計數器。

#### 情境：計數器反映處理
- **WHEN** machine 投影 consumer 處理一個 `TEMPERATURE_REPORTED` 事件
- **THEN** 標籤為（`TEMPERATURE_REPORTED`、machine consumer group）的計數器增加，可在可觀測性堆疊中查詢

### 需求：遙測經 OTLP 送到本機 demo 堆疊，且它不存在時無害
系統 SHALL 把 traces、metrics 與 logs 經 OTLP 匯出到由 `OTEL_EXPORTER_OTLP_ENDPOINT` 設定的端點（compose 的 `lgtm` 服務 — `grafana/otel-lgtm`），SHALL 支援 `OTEL_SDK_DISABLED=true` 作為關閉開關，且在可觀測性容器不存在或不可達時 SHALL 完全相同地啟動並提供所有功能。

#### 情境：遙測在 Grafana 可見
- **WHEN** compose 堆疊帶著 `lgtm` 服務運行且 demo 流量流動
- **THEN** traces 可在 Tempo 查詢、logs 在 Loki（以 trace id 關聯）、events-processed metric 在 Prometheus，全部經由專屬埠上的 Grafana

#### 情境：可觀測性容器停止，平台不受影響
- **WHEN** `lgtm` 容器被停止且完整的 demo 流程被執行
- **THEN** 每個 API 呼叫、consumer 與前端行為都與之前完全相同，沒有錯誤浮現給客戶端、沒有崩潰循環
