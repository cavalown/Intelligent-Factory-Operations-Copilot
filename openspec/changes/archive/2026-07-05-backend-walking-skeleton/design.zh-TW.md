## 脈絡

設計階段已完成並記載於 `docs/`：事件信封與 payload 綱要（`docs/design/event-schema.md`）、REST 契約（`docs/design/api.md`）、機台領域模型與狀態/健康分數規則（`docs/design/machine-schema.md`）、整體架構（`docs/design/architecture.md`）、本機基礎設施（`docs/deployment/docker-compose.md`）。Kafka（KRaft 模式、雙 listener）與 MongoDB 已透過根 `docker-compose.yml` 在本機運行，並以手動 produce/consume 測試端到端驗證過。

還沒有任何應用程式碼。這是第一個寫真實後端程式碼的變更，並刻意把範圍縮限到一種事件類型（`TEMPERATURE_REPORTED`），先證明架構再擴展廣度。

## 目標 / 非目標

**目標：**
- 用真實程式碼證明核心架構模式：獨立的 Kafka consumer，各自從同一事件建立自己的投影，彼此之間沒有直接的程序內耦合。
- 建立 `docs/design/architecture.md` §14.1 的模組邊界（`events/`、`machines/`、`alerts/`、`insights/`、`simulator/`、`shared/`），讓未來的模組（包括之後的事件轉譯層）有明顯的落腳處，但不承諾一定會把它們抽成獨立服務（見加到 `architecture.md` §14.2 的參考選項註記）。
- 完整涵蓋一種事件類型：攝取 → Kafka 發布 → 3 個獨立 consumer → 讀取 API。

**非目標：**
- 實作其他 4 種事件類型（`STATUS_CHANGED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED`）— 後續變更。
- Insight Service / AI 摘要端點 — 後續變更，依約定的開發順序與 `ADR-0004` 刻意放最後。
- 前端。
- 告警確認/解決工作流程與升級規則 — 這些是 Phase 2 路線圖項目（`docs/product/product-roadmap.md`），不在 MVP 範圍。
- 身分驗證 — 明確排除在 MVP 範圍外（`CLAUDE.md`）。

## 決策

**Kafka client：直接用 `kafkajs`、包在普通的 NestJS provider 裡 — 不用 `@nestjs/microservices` 的 Kafka transport。**
*（實作期間修訂 — 見下方註記。）* `kafkajs` 沒有需要編譯的原生綁定，文件也完善。曾考慮的替代方案：`node-rdkafka`（C++ 綁定）— 理論上更快，但增加原生依賴的建置複雜度，在這個事件量下沒有實質回報。

這個決策原本寫的是「`@nestjs/microservices` 搭配 Kafka transport」，假設使用 NestJS 官方欽定的整合路徑是慣用選擇。實作揭露了一個問題：`@nestjs/microservices` 的混合應用模型（`app.connectMicroservice()`）會把應用程式中每個以 `@EventPattern` 裝飾的 handler 附加到你連接的*每一個* microservice context — 沒有內建方法在單一 Nest 應用程式內界定「這些 handler 屬於 consumer group A、那些屬於 B」。要用官方方式取得 3 個真正獨立的 consumer group（Event/Machine/Alert Service）就得拆成 3 個獨立的 Node 程序，這直接違背 `ai/rules/module-boundaries.md` 的模組化單體決策。直接使用 `kafkajs` 的 client — 每個模組建立一個 `kafka.consumer({ groupId })`、以普通的 `OnModuleInit`/`OnModuleDestroy` 生命週期 hook 管理 — 在單一程序內乾淨地支援這點。這也是 Kafka 本身的設計模式：獨立 consumer group 讀同一個 topic 是「多個獨立應用程式各拿到完整串流副本」的標準機制，不是邊角情況。

`@nestjs/microservices` 從依賴中移除（一旦不用它的 transport 抽象，它就沒有貢獻）。

**MongoDB 存取：`@nestjs/mongoose`。**
以 schema 為基礎的存取，對應 `machine-schema.md` 與 `architecture.md` §12 已寫好的欄位定義。曾考慮的替代方案：原始 `mongodb` driver — 控制更多，但我們得手工做 Mongoose schema 免費提供的驗證，在這個階段沒有對應的好處。

**每個 consumer 有自己的 Kafka consumer group ID**（例如 `event-service-group`、`machine-service-group`、`alert-service-group`），不共用 group。
這是讓「獨立 consumer」真正成立的關鍵細節 — 如果 Event Service 與 Machine Service 共用一個 consumer group，Kafka 會把訊息拆分給它們（負載平衡），各自只看到一半的事件。分開的 group 表示每個 consumer 看到每一則訊息，符合 `architecture.md` §9 的扇出設計。

**冪等性，為本變更做最小限度的界定：**
- Event Service：`machine_events.eventId` 上的唯一索引（`architecture.md` §12.1 已建議）；duplicate-key 插入錯誤被接住並視為 no-op。
- Alert Service：`alerts.eventId` 上的唯一索引，同樣的 duplicate-key 即 no-op 處理。（目前設計中一個事件最多產生一個告警，所以這個 1:1 索引成立。）
- Machine Service：套用前把進來事件的 `eventId` 與機台文件的 `lastEventId` 比對，依 `machine-schema.md` §7 既有的虛擬碼。這只防止*緊接在前的*事件被重複處理兩次 — `machine-schema.md` §8 已記載這個限制，並把更完整的方案延到真正需要時。本變更不在這裡嘗試解決那個問題。

**Topic 建立：** 依賴根 `docker-compose.yml` 已設定並驗證的 `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` — 本變更的後端不需要明確的 topic 建立程式碼。

**Demo 機台 seed：** 一個小的硬編碼 seed 步驟（後端啟動時執行或經 seed 腳本），按 `machineId` upsert 一組固定的機台名單，依 `machine-schema.md` §11（機台是預先 seed 的，不自動建立）。重用 `api.md`、`machine-schema.md` 與 `event-flow.md` 一貫使用的 `M-001` / "CNC Mill 01" / `temperatureThreshold: 80` 範例，再加 1-2 台機台，讓之後的多機台 demo 更可信。

## 風險 / 取捨

- **[風險]** Machine Service 只靠 `lastEventId` 的重複防護擋不住較舊事件的亂序重送。→ **緩解：** 依 `machine-schema.md` §8 在 MVP 接受；只有在真的出現重複處理的 bug 時才重新檢視。
- **[風險]** seed 步驟執行多次可能重複機台文件。→ **緩解：** 以 `machineId` upsert，而非無條件插入。
- **[風險]** 根 `docker-compose.yml` 的 `backend` 服務區塊目前被註解掉（指向本變更之前不存在的 `backend/` 目錄），可能被遺忘。→ **緩解：** 取消註解並驗證它是 `tasks.md` 的明確任務。
- **[風險]** 驗證只涵蓋 `TEMPERATURE_REPORTED` 表示 `POST /simulator/events` 在後續變更落地前會拒絕其他 4 種事件類型。→ **緩解：** 依約定的 walking-skeleton 優先開發順序，可接受且刻意；也不算回歸，因為其他事件類型在任何地方都還沒實作。

## 遷移計畫

綠地專案 — 沒有既有資料或已部署程式碼需要遷移。

1. 搭建 `backend/`（NestJS 專案 + 模組資料夾）。
2. 取消註解並對齊根 `docker-compose.yml` 的 `backend` 服務區塊。
3. 為 `TEMPERATURE_REPORTED` 實作攝取、3 個 consumer 與讀取端點。
4. 加入機台 seed 步驟。
5. `docker compose up --build backend`，與已運行的 `kafka`/`mongodb` 一起，手動走一遍 `docs/design/event-flow.md` §3 的情境，確認它現在用真實程式碼可行，而不只是紙上談兵。

除了 `docker compose down` 沒有回滾顧慮 — 還沒有任何外部東西依賴這個。

## 未決問題

- `M-001` 之外的確切 seed 名單（幾台 demo 機台、名稱、閾值）— 可以在寫 seed 步驟時決定；風險低、之後容易改。
- 自動化測試策略（單元測試 vs. 對真實 Kafka/Mongo 的整合測試，例如透過 Testcontainers）在此不決定 — 不在本變更範圍，等 walking skeleton 存在、有東西可測之後，值得一個專門的後續決策。
