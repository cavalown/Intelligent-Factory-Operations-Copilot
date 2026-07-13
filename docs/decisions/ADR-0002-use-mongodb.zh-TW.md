# ADR-0002：使用 MongoDB 存放事件與投影

## 狀態

已接受（Accepted）

## 脈絡

IFOC 儲存兩種結構上不同的資料。`machine_events` 存放只增不改（append-only）的歷史，每種事件類型（`STATUS_CHANGED`、`TEMPERATURE_REPORTED`、`ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`、`PRODUCTION_COMPLETED`）各有自己的 `payload` 形狀（`docs/design/event-schema.md` §5）。`machines`、`alerts` 與 `ai_summaries` 存放投影，讀遠多於寫，而且形狀在 MVP 演進期間仍可能改變。

MVP 也需要快速推進 — 這是一個設計階段的專案，還沒有正式資料，所以早期迭代時的綱要彈性比嚴格的事前正規化更重要。

## 決策

四個 MVP collection 全部使用 MongoDB：`machine_events`、`machines`、`alerts`、`ai_summaries`。

## 後果

**變容易的：**

* 每種 `eventType` 各自不同的 `payload` 形狀可以原樣存進 `machine_events`，不需要僵硬的預先宣告欄位綱要，也不需要一張塞滿可空欄位的寬表。
* 投影文件（`machines`、`alerts`、`ai_summaries`）直接對應 API 回傳的 JSON 形狀（`docs/design/api.md` §5）— 不需要 ORM／關聯式轉 JSON 的轉換層。
* MVP 迭代期間的綱要變更（payload 加欄位、新增事件類型）不需要先跑 migration 才能寫入下一筆事件。

**變困難的：**

* MongoDB 不會在資料庫層強制執行事件信封或 payload 綱要 — 驗證必須完全在應用程式碼中進行（`event-schema.md` §9），所以 consumer 的 bug 可能寫入格式錯誤的文件，而關聯式綱要會直接拒絕。
* 跨 collection 的一致性（例如某個 alert 的 `eventId` 已不存在）沒有外鍵強制；仰賴 consumer 的正確性。
* 如 `docs/design/architecture.md` §14.2 所述，若儀表板查詢在規模擴大後變得昂貴，MongoDB 的彈性就是拿關聯式儲存免費提供的索引化、正規化查詢效能去換的。

## 曾考慮的替代方案

* **PostgreSQL（關聯式）** — 能在資料庫層強制信封綱要與外鍵完整性，這是真實的價值。MVP 階段否決，因為各事件類型的 payload 要嘛需要一張寬的可空欄位表，要嘛需要一個 JSONB 欄位（後者反而放棄了大部分關聯式的好處），而且對團隊來說，通往可運作 MVP 最快的路是綱要彈性的文件式儲存。
* **DynamoDB／託管 NoSQL** — 彈性與 MongoDB 類似，但在部署故事（`architecture.md` §13）還停留在 Docker Compose 的階段，就把 MVP 綁定到特定雲端廠商。MongoDB 在本機與任何未來的雲端目標上運作方式完全相同。
* **Elasticsearch 作為主要儲存** — 很適合 `docs/product/product-roadmap.md` Phase 3 規劃的事件搜尋功能，但它的設計不是要當具備強一致性保證的系統紀錄（system of record）。更適合未來作為 `machine_events` 之上的次要索引，而非主要儲存。
