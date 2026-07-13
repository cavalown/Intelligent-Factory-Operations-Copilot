# 設計：add-observability

## 脈絡

現況：Nest 預設的人類可讀 logger 輸出到 stdout（14 個呼叫點，全是決策點上的警告/錯誤）、kafkajs 自己的 JSON 日誌交錯在同一條串流、完全沒有 HTTP 請求日誌，也沒有 API 呼叫與其觸發的 consumer 工作之間的執行期關聯。事件信封的 `correlationId` 存在，卻從未進入任何日誌或 trace。Phase 1.1（路線圖）承諾以 demo 等級採用 OpenTelemetry + Grafana 堆疊 — 使用者的明確定調：「畢竟是 demo，根本不會部署」，且 Phase 3 之前不用付費服務。

## 目標 / 非目標

**目標：**

- 一條 trace 橫跨 simulator POST → Kafka 發布 → 三個 consumer（event/machine/alert），可在 Grafana Tempo 檢視。
- 每行日誌都是 JSON；請求範圍的行帶 `trace_id`；consumer 的行帶事件的 `correlationId` 與 `eventId`。
- HTTP 存取日誌（方法、路徑、狀態、時長）— 500 再也不會隱形。
- `ifoc.events.processed` 計數器（標籤：`eventType`、consumer group）作為自訂 metric 的模式。
- 有沒有可觀測性容器，後端行為完全相同。

**非目標：**

- 瀏覽器/前端遙測；正式生產的 LGTM 部署；取樣策略（demo 維持 100%）；告警規則；日誌保留政策（lgtm 容器設計上就是短暫的）；替換 kafkajs 的內部 logger。

## 決策

### D1：OTel 以預載模組啟動，自動儀器化優先於手動 span

`backend/src/instrumentation.ts` 以 `@opentelemetry/auto-instrumentations-node` 與 OTLP exporter 初始化 `NodeSDK`，在 `main.ts` 中最先 import（在 Nest/Express/Mongoose/kafkajs 載入之前，儀器化需要如此）。手動 span 只用在自動 span 缺乏領域意義之處（初期不需要 — consumer 處理已透過 kafkajs 儀器化可見）。理由：自動儀器化涵蓋 HTTP/Mongoose/kafkajs，包括**透過 Kafka header 的 context 傳播** — 手工重做那個傳播，正是第一份回顧紀錄模式 3 警告的那種基礎設施重複。

### D2：日誌 — 透過 nestjs-pino 用 pino，雙目的地（stdout JSON + OTLP）

`nestjs-pino` 成為 Nest `Logger` 門面背後的 logger 實作（`app.useLogger`），所以**既有 14 個呼叫點全部不變地繼續運作**。pino 輸出 JSON 到 stdout（docker logs 保持有用，12-factor 保留），一個 mixin 把作用中的 `trace_id`/`span_id` 注入每一行。日誌也經 OTel logs 管線送到 Loki，讓 Grafana 能在日誌↔trace 之間跳轉。誠實註記：OTel 的 Node log signal 是三者中最不成熟的 — 若 OTLP 日誌傳輸不穩，這裡記載的 fallback 是只輸出 stdout JSON（Loki 失去日誌，但其他都不降級；traces/metrics 不受影響）。HTTP 存取日誌由 nestjs-pino 內的 `pino-http` 免費提供。

### D3：一個 `grafana/otel-lgtm` 容器 — demo 等級的 Grafana 堆疊

官方的 all-in-one 映像檔（Collector + Loki + Tempo + Prometheus + Grafana），正是為 dev/demo 而生。Compose 增加一個 `lgtm` 服務；Grafana UI 在 `:3001`（後端佔用 `:3000`）。儲存是短暫的 — 重啟就清空遙測，對 demo 沒問題，也強化了「這不是正式生產姿態」。若日後真的需要，升級路徑是：把這一個容器換成真正的 LGTM 元件；後端的 `OTEL_EXPORTER_OTLP_ENDPOINT` 就是全部的耦合面。否決的替代方案：現在就上完整拆分堆疊（5 個容器、2GB+、沒人需要的正式生產姿態 — 「根本不會部署」）；託管服務（違反不花錢原則）。

### D4：領域身分與傳輸身分並存

W3C trace context 回答「哪些 span 屬於這個請求」；信封的 `correlationId` 回答「這是哪個業務流程」（它在重播、批次情境中存活，並出現在已儲存的事件裡）。Consumer 把兩者都設為 span 屬性（`ifoc.correlation_id`、`ifoc.event_id`、`ifoc.event_type`）與日誌欄位。誰也不取代誰。

### D5：fail-soft 是需求，不是指望

端點不可達時，OTLP exporter 會安靜地緩衝後丟棄（SDK 預設行為 — 在 demo 檢查清單中驗證、不是假設，依回顧紀錄模式 4 關於被斷言的函式庫宣稱）。`OTEL_SDK_DISABLED=true` 提供硬開關。規格有明確情境：停掉 lgtm 容器，整個 demo 流程仍然通過。

### D6：環境變數遵循既有的註冊表模式

`OTEL_EXPORTER_OTLP_ENDPOINT`（compose 中預設 `http://lgtm:4318`，未設定 ⇒ exporter 在本機 no-op）、`OTEL_SERVICE_NAME=ifoc-backend`、`OTEL_SDK_DISABLED`。全部記載於 `docker-compose.md` §5（環境變數註冊表 — dashboard-metrics 回顧紀錄的模式 3：在同一變更中擴充註冊表）。

## 風險 / 取捨

- [lgtm 容器在一台碰過磁碟滿的機器上佔約 1GB RAM] → 一句 `docker compose stop lgtm` 就能關掉，且 D5 保證其他一切都不在乎。
- [自動儀器化增加啟動延遲與每請求負擔] → 在 demo 負載下可忽略；取樣刻意維持 100%（demo 想要每一條 trace）。
- [OTel Node log signal 的成熟度] → D2 記載的 fallback（只輸出 stdout JSON）把影響範圍限制在「Grafana 失去日誌面板」。
- [換成 pino 可能改變測試或腳本 grep 的日誌時間戳/格式] → 今天沒有任何東西 grep 日誌輸出（已驗證：沒有 CI、沒有解析日誌的腳本）；`docker logs` 的消費者是人。

## 未決問題

1. Grafana 佈建：要出貨一個預建的儀表板 JSON（events-processed 速率、HTTP 延遲），還是讓 demo 直接用 Tempo/Loki 的 explore 視圖？（傾向：先用 explore 視圖，demo 腳本需要亮點畫面時再做儀表板。）
2. Simulator 的前端頁面要不要顯示它產生的 `correlationId`，讓 demo 操作者可以貼進 Grafana？（不錯的 demo 黏合劑；實作時決定。）
