# ADR-0001：使用 Kafka 作為事件骨幹

## 狀態

已接受（Accepted）

## 脈絡

IFOC 需要讓一個機台事件獨立驅動多種不同的結果：不可變的歷史儲存、目前狀態的投影（projection）、告警偵測，以及（隨需的）AI 摘要脈絡。這些 consumer 必須能隨時間新增 — Predictive Maintenance 與 Digital Twin 的 consumer 已排入路線圖後期階段 — 而不需要改寫 producer 或既有 consumer。

在同一台機台內，事件順序很重要：`STATUS_CHANGED` 之後接著 `ERROR_OCCURRED`，就必須按這個順序處理，否則投影會出錯。跨不同機台之間，順序無關緊要。

## 決策

使用 Kafka 作為事件骨幹。Machine Simulator（以及未來的 producer）發布到單一 `machine.events` topic，以 `machineId` 作為 key。Event Service、Machine Service 與 Alert Service 各自獨立訂閱，從同一條事件流建立自己的視圖。

## 後果

**變容易的：**

* 新的 consumer（Predictive Maintenance、Digital Twin）可以直接訂閱 `machine.events`，不用動 producer 或既有 consumer — 見 `docs/design/architecture.md` §9.5。
* 以 `machineId` 作為 key，在同一分割區內保證每台機台的順序，不需要分散式鎖或序號機制。
* 事件重播（`architecture.md` §10.4）天然適合 log 結構的系統，支撐未來的 Digital Twin 模擬與投影復原。

**變困難的：**

* Consumer 必須處理非同步、最終一致的處理流程 — 客戶端發完事件後立刻讀 `GET /machines/:id` 可能看到過期資料（`architecture.md` §15）。
* Consumer 必須自行實作以 `eventId` 為基礎的冪等性；Kafka 的 at-least-once 遞送預設不保證 exactly-once 處理。
* 相較於更簡單的佇列，在本機跑 Kafka 增加了運維重量（Docker Compose 裡要有 broker 加上 Zookeeper/KRaft controller）。

## 曾考慮的替代方案

* **RabbitMQ／傳統訊息佇列** — 擅長點對點的工作分配，但「多個獨立 consumer 讀取同一條訊息流」對佇列而言是次要考量，不是它的核心設計。Kafka 以 log 為基礎的 pub/sub 模型更直接符合 IFOC「一個事件、多個投影」的形態。
* **模組之間直接 REST 呼叫**（simulator 同步呼叫每個服務）— 最容易建，但會把 producer 耦合到每一個現在與未來的 consumer，也沒有事件歷史或重播能力。因違背 `architecture.md` §3「事件是唯一真實來源」的原則而否決。
* **資料庫輪詢／不用 broker 的 outbox 表** — 可以不用在本機跑 Kafka，但要重新發明 Kafka 已經解決的順序、遞送與多 consumer 扇出問題，也無法為架構在後期階段想要的事件重播方向鋪路。
