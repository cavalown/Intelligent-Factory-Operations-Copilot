# Docker Compose（本機開發）

## 1. 目的

本文件定義在本機執行 IFOC 所有 MVP 服務的 Docker Compose 設定：frontend、backend、MongoDB、Kafka，以及 `lgtm` 可觀測性堆疊（Phase 1.1）。這是 MVP 唯一的部署目標 — 見 `docs/design/architecture.md` §13.1（MVP 不用 Kubernetes、不用託管雲端服務）。

Kafka 從 MVP 第一天就開始運行，不是後續階段才加入 — 它是 `CLAUDE.md` 所描述的核心 `simulator → Kafka → consumers → MongoDB` 流程的事件骨幹，所以從一開始就跟其他服務放在同一個 Compose 檔裡。

拓撲圖原始檔：[`docs/assets/mermaid/deployment-topology.mmd`](../assets/mermaid/deployment-topology.mmd)。

---

## 2. 服務總覽

| 服務 | 映像檔 | 用途 | 主機埠 |
| --- | --- | --- | --- |
| `frontend` | 由 `frontend/` 建置（Vue 3 + TypeScript） | 操作員儀表板。 | `5173` |
| `backend` | 由 `backend/` 建置（NestJS 模組化單體） | REST API、Kafka consumer、Insight Service。 | `3000` |
| `mongodb` | `mongo:7` | 存放 `machine_events`、`machines`、`alerts`、`ai_summaries`。 | `27017` |
| `kafka` | `apache/kafka:3.8.0` | 事件骨幹，topic `machine.events`。以 **KRaft 模式**運行 — 不需要獨立的 Zookeeper 容器。 | `9092` |
| `lgtm` | `grafana/otel-lgtm:latest` | Demo 量級的可觀測性堆疊(Collector + Loki + Tempo + Prometheus + Grafana 全部在一個容器裡) — 見 `docs/product/product-roadmap.md` Phase 1.1。儲存為暫存性；這個容器不存在或停止時，平台照常運作。 | `3001`(Grafana UI)、`4318`(OTLP HTTP) |

五個服務、沒有 Zookeeper — 選 KRaft 模式正是為了讓本機 MVP 的佔用維持在每個關注點一個容器（`docs/decisions/ADR-0001-use-kafka.md` 說明為什麼選 Kafka 本身；本文件只說明它在本機怎麼跑）。

---

## 3. `docker-compose.yml`

```yaml
services:
  kafka:
    image: apache/kafka:3.8.0
    container_name: ifoc-kafka
    ports:
      - "9092:9092"
      - "9093:9093"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,PLAINTEXT_HOST://0.0.0.0:9093,CONTROLLER://0.0.0.0:9094
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9094
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
    volumes:
      - kafka_data:/var/lib/kafka/data

  mongodb:
    image: mongo:7
    container_name: ifoc-mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  lgtm:
    image: grafana/otel-lgtm:latest
    container_name: ifoc-lgtm
    ports:
      - "3001:3000" # Grafana UI（backend 已經佔用主機 :3000）
      - "4318:4318" # OTLP HTTP receiver

  backend:
    build: ./backend
    container_name: ifoc-backend
    restart: on-failure
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      MONGODB_URI: mongodb://mongodb:27017/ifoc
      KAFKA_BROKERS: kafka:9092
      KAFKA_TOPIC_MACHINE_EVENTS: machine.events
      KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED: machine.events.enriched
      LLM_PROVIDER: ${LLM_PROVIDER:-mock}
      LLM_API_KEY: ${LLM_API_KEY:-}
      LLM_MODEL: ${LLM_MODEL:-}
      OTEL_SERVICE_NAME: ifoc-backend
      OTEL_EXPORTER_OTLP_ENDPOINT: http://lgtm:4318
      OTEL_SDK_DISABLED: ${OTEL_SDK_DISABLED:-false}
    depends_on:
      - kafka
      - mongodb
      # 刻意不列 lgtm：backend 在任何時間點都不需要它就緒（OTLP 匯出不論啟動順序都
      # fail-soft — 見 design.md D5），而且 depends_on 會讓 lgtm image pull 失敗
      # 時（例如離線、registry rate limiting）連帶卡住 backend 自己的啟動。

  frontend:
    build: ./frontend
    container_name: ifoc-frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_BASE_URL: http://localhost:3000/api
    depends_on:
      - backend

volumes:
  kafka_data:
  mongo_data:
```

---

## 4. Kafka 設定註記

* **KRaft 合併模式**：`kafka` 在單一容器內同時擔任 broker 與 controller（`KAFKA_PROCESS_ROLES: broker,controller`）— 適合單節點本機開發叢集，不是正式環境拓撲。
* **Topic 自動建立**：`KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"` 表示 `machine.events` 會在 producer 第一次發布時自動建立。MVP 不需要 init 容器或手動建 topic 的步驟。
* **分割區（Partitions）**：自動建立的 topic 會使用 broker 的預設分割區數（未覆寫時為 1）。一個分割區對 MVP 的事件量已足夠，而且天然保序。即使只有一個分割區，用 `machineId` 作為訊息 key（`event-schema.md` §8）仍是正確做法 — 之後若為了吞吐量增加分割區數，各機台內的順序會自動保留，producer/consumer 程式碼都不用改。
* **內部 vs. 主機定址（雙 listener）**：Kafka 刻意曝露兩個獨立的 listener。`PLAINTEXT`（`kafka:9092`，advertised 為 `kafka:9092`）給容器對容器流量 — 容器化的 `backend` 服務用的就是這個。`PLAINTEXT_HOST`（`localhost:9093`，advertised 為 `localhost:9093`）給任何從主機連進來的東西 — 本機的 Kafka CLI，或原生執行而非跑在 Docker 裡的 `backend` 程序（見 `docs/deployment/local-development.md`）。單一 listener 無法同時滿足兩種情境：初次連線之後，Kafka client 會改用 broker *advertised* 的位址重新連線，而主機程序無法解析 Docker 內部主機名稱 `kafka`。
* **已知的冷啟動競態**：全新的 `docker compose up --build backend` 時，後端的 4 個獨立 consumer group（`event-service-group`、`machine-service-group`、`alert-service-group`、`rules-service-group`）會同時向單一 broker 叢集請求 group coordinator。實際觀察到這偶爾會拋出一個未重試的 `KafkaJSProtocolError`，讓後端程序在第一次開機時就崩潰。`backend` 服務上的 `restart: on-failure`（已加入上方 Compose 檔）會自動恢復 — 一旦 broker 的 coordinator metadata 穩定下來，重試必定成功。這是單 broker 開發叢集的怪癖，不是應用程式的 bug。

---

## 5. 環境變數

| 變數 | 服務 | 說明 |
| --- | --- | --- |
| `MONGODB_URI` | `backend` | MongoDB 連線字串。 |
| `KAFKA_BROKERS` | `backend` | Kafka bootstrap server 位址。 |
| `KAFKA_TOPIC_MACHINE_EVENTS` | `backend` | Topic 名稱，保持為變數而非寫死，讓 `docs/design/event-schema.md` §8 的命名慣例可以演進而不需改程式。 |
| `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED` | `backend` | Rule Engine 重新發布分類後事件的 topic；Machine Service 與 Alert Service 改訂閱這個，不再訂閱 `KAFKA_TOPIC_MACHINE_EVENTS`（`openspec/changes/add-rule-engine/design.md` D1）。預設為 `machine.events.enriched`，與原始 topic 一樣是自動建立。 |
| `LLM_PROVIDER` | `backend` | Insight Service 要使用哪個 LLM adapter。預設為 `mock`（內建、不需 API key），讓本機開發與 demo 不需外部憑證即可運行；未知的值會讓啟動快速失敗。 |
| `LLM_API_KEY` | `backend` | Insight Service 呼叫 LLM API 的憑證（`architecture.md` §7.6）。不進版控 — 透過本機 `.env` 檔或 shell 環境提供。`mock` provider 不使用。 |
| `LLM_MODEL` | `backend` | 傳給所設定 LLM provider 的模型識別碼。`mock` provider 不使用。 |
| `OTEL_SERVICE_NAME` | `backend` | 附加在所有輸出的 trace／metric／log 上的服務名稱(`backend/src/instrumentation.ts`)。預設為 `ifoc-backend`。 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `backend` | OTel SDK 透過 OTLP/HTTP 送出 trace／metric／log 的目標基底 URL。預設為 `http://localhost:4318`(OTel 規格的預設值);在 Compose 中設為 `http://lgtm:4318`。連不到也無妨 — exporter 會緩衝後丟棄(Phase 1.1，`openspec/changes/add-observability/design.md` D5)。 |
| `OTEL_SDK_DISABLED` | `backend` | 設為 `true` 會完全停用 OTel SDK(不輸出 trace／metric／log，也不做 auto-instrumentation)。預設為 `false`。 |
| `VITE_API_BASE_URL` | `frontend` | 儀表板連到後端的基底 URL，對應 `docs/design/api.md` §2.1。 |

`LLM_API_KEY` 應透過本機 `.env` 檔（已 gitignore）或 shell 環境提供 — 絕不提交進 repository。

---

## 6. 啟動

```bash
docker compose up -d
```

預期順序：`kafka` 與 `mongodb` 先啟動（無依賴），接著 `backend`（依賴兩者），最後 `frontend`（依賴 `backend`）。後端啟動時應重試 Kafka/MongoDB 連線而不是崩潰循環，因為 Compose 的 `depends_on` 只等容器啟動，不等 Kafka/MongoDB 真正可以接受連線。`lgtm` 是獨立啟動的，跟 `backend` 之間沒有任何依賴關係 —— 這是刻意設計：backend 不會等它啟動（所以 `lgtm` image pull 失敗或很慢都不會卡住 backend），而且不論 `lgtm` 存在、不存在、停止或被移除,backend 都能正常服務,見 `add-observability/design.md` D5。

要重置所有本機資料（事件、投影、Kafka log）：

```bash
docker compose down -v
```

---

## 7. 未定假設

1. **Kafka 映像檔**：`apache/kafka:3.8.0`，內建 KRaft 支援的官方 Apache Kafka 映像檔。同等的 Bitnami 或 Confluent 映像檔搭配不同的環境變數名稱也可行 — 這個選擇尚未針對團隊熟悉度或授權偏好驗證過。
2. `machine.events` 使用**單一 Kafka 分割區**（見 §4）。對 demo 規模的事件量沒問題；若本機負載測試顯示需要更多 producer/consumer 平行度再重新檢視。
3. **`LLM_API_KEY`** 是通用的占位名稱。實際的 LLM 供應商（因此真正的環境變數名稱／形式，例如 OpenAI 式 key vs. Anthropic 式 key）尚未決定 — `architecture.md` 與 `mvp.md` 只寫「LLM API」，沒有指名廠商。

若上述任一項改變，只需要更新本文件 — 它們不影響已寫定的事件綱要、API 契約或機台綱要。
