# 提案：add-observability

## 為什麼

平台自身的執行期行為是隱形的：HTTP 請求（包括 500）不留任何痕跡、現有 14 個日誌呼叫點輸出的非結構化文字與 kafkajs 的 JSON 混在同一個 stdout，而且沒有任何機制把一個 API 請求與它觸發的 Kafka consumer 工作關聯起來 — 即使事件信封從第一天起就帶著 `correlationId`。2026-07-12 決定（探索階段）：採用 OpenTelemetry + Grafana 可觀測性堆疊作為路線圖的 **Phase 1.1** — 分量足以自成一個子階段，又基礎到不該等到 Phase 2。刻意採 demo 等級：本專案不部署到正式環境。

## 改什麼

- **後端 OpenTelemetry 儀器化**：`@opentelemetry/auto-instrumentations-node` 在 Nest 之前啟動 — 自動為 HTTP/Express、Mongoose 與 kafkajs 產生 traces 與 metrics（W3C trace context 透過 Kafka 訊息 header 傳播，因此一條 trace 橫跨 simulator POST → 發布 → 三個 consumer）。
- **帶 trace 關聯的結構化 JSON 日誌**：`nestjs-pino` 取代預設的 Nest logger transport（既有的 `Logger` 呼叫點透過 `app.useLogger` 繼續運作）；每一行請求範圍的日誌帶 `trace_id`/`span_id`；HTTP 存取日誌隨之而來 — 從兩個方向堵上「500 卻無痕跡」的洞。
- **領域關聯**：事件信封的 `correlationId` 在三個 consumer 中都成為 span 屬性與日誌欄位（領域身分與傳輸身分並存）。
- **一個自訂 metric** 作為模式定調者：`ifoc.events.processed` 計數器，以 `eventType` 與 consumer group 為標籤。
- **一個新的 compose 服務**：`grafana/otel-lgtm`（單一容器內含 Collector + Loki + Tempo + Prometheus + Grafana，官方 demo/dev 映像檔）。後端透過 OTLP 送出遙測；Grafana 在 `:3001`。
- **優雅降級**：lgtm 容器不存在時，後端的啟動與運行完全相同（exporter 失敗保持安靜；支援 `OTEL_SDK_DISABLED=true`）。
- 文件：`docker-compose.md`（服務 + `OTEL_*` 環境變數註冊表），路線圖已加入 Phase 1.1。

不在範圍內：前端／瀏覽器遙測；正式生產形態的 LGTM 堆疊（OTLP 端點就是穩定介面 — 之後把 demo 容器換成真正的元件不需要碰任何應用程式碼）；付費／託管的可觀測性服務；針對遙測的告警。

## 能力

### 新能力

- `observability`：橫跨 HTTP 與 Kafka 的端到端追蹤、結構化且 trace 關聯的日誌、events-processed metric、OTLP 送到本機堆疊，以及沒有它時的 fail-soft 行為。

### 修改的能力

無 — 沒有任何既有能力的需求改變；儀器化是加法性的基礎設施。

## 影響

- **程式碼**：後端 `instrumentation.ts`（OTel 啟動，在 Nest 之前載入）、`main.ts`（pino logger 接線）、consumer 類別（correlationId 屬性 + 計數器）、`env.config.ts` 新增項目。
- **依賴**：OTel SDK 套件、`nestjs-pino`/`pino`（全部開源；不花錢）。
- **基礎設施**：一個新的 compose 服務（`lgtm`），運行時約 1GB RAM；可選（profile 或直接 `docker compose up` 就包含它）。
- **文件**：`docs/deployment/docker-compose.md`（服務表 §2、環境變數 §5）、`docs/product/product-roadmap.md` + `ai/context/roadmap-summary.md`（Phase 1.1 — 已隨本提案套用）。
- **無 API 契約變更**；無前端變更。
