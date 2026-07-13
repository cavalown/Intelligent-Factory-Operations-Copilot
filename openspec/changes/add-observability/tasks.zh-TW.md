# 任務：add-observability

## 1. OTel 啟動

- [ ] 1.1 加入 OTel 依賴（`@opentelemetry/sdk-node`、`auto-instrumentations-node`、OTLP exporter）與 `backend/src/instrumentation.ts`（NodeSDK 初始化、服務名稱、來自環境變數的 OTLP 端點、尊重 `OTEL_SDK_DISABLED`），在 `main.ts` 中最先 import
- [ ] 1.2 環境變數：`OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` / `OTEL_SDK_DISABLED` 加入 `env.config.ts`，遵循純 `process.env` 模式
- [ ] 1.3 驗證（不是假設 — 回顧紀錄模式 4）exporter 的 fail-soft：在沒有任何 collector 可連、以及 `OTEL_SDK_DISABLED=true` 時後端都乾淨啟動

## 2. 結構化日誌

- [ ] 2.1 把 `nestjs-pino` 接為 Nest logger（`app.useLogger`）；JSON 輸出到 stdout；確認既有 14 個 `Logger` 呼叫點仍然輸出
- [ ] 2.2 透過 pino mixin 在每行日誌注入 `trace_id`/`span_id`；日誌經 OTel logs 管線送到 Loki（記載的 fallback：若 Node log signal 不穩就只輸出 stdout JSON）
- [ ] 2.3 透過 nestjs-pino 的請求日誌做 HTTP 存取日誌（方法、路徑、狀態、時長）；確認一個強制的 5xx 同時出現在存取日誌與帶錯誤的 trace span

## 3. 領域關聯 + metric

- [ ] 3.1 在三個 consumer 的訊息處理中加入 `ifoc.correlation_id` / `ifoc.event_id` / `ifoc.event_type` span 屬性與日誌欄位
- [ ] 3.2 加入 `ifoc.events.processed` 計數器（標籤：eventType、consumer group），在每個 consumer 成功處理時遞增

## 4. Compose + 文件

- [ ] 4.1 在 docker-compose.yml 加入 `lgtm` 服務（`grafana/otel-lgtm`）— Grafana 在 `:3001`、OTLP `:4318`；後端取得 `OTEL_EXPORTER_OTLP_ENDPOINT=http://lgtm:4318`
- [ ] 4.2 更新 `docs/deployment/docker-compose.md`：服務表（§2）+ §5 註冊表中所有 `OTEL_*` 環境變數
- [ ] 4.3 註冊表掃描（回顧紀錄模式 3）：確認沒有其他列舉式文件需要新成員（沒有新模組、沒有新 collection、沒有新錯誤代碼、沒有 API 變更）

## 5. 驗證

- [ ] 5.1 堆疊運行時的 demo 流程：simulator POST → Tempo 中一條橫跨 HTTP + producer + 三個 consumer 的 trace，帶 correlationId 屬性；Loki 中帶 trace_id 的存取日誌；Prometheus 中的 events-processed metric — 全部透過 Grafana
- [ ] 5.2 `lgtm` 停止時的 demo 流程：完整的 API + 前端行為完全相同、無客戶端可見錯誤、後端日誌透過 `docker logs` 仍是可讀的 JSON
