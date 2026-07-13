# 最小可行產品（MVP）

## 目標

打造 **IFOC（Intelligent Factory Operations Copilot，智慧工廠營運助理）** 第一個可展示的版本。

MVP 應展示一套現代智慧工廠平台完整的端到端工作流程：

* 模擬工廠事件
* 透過 Kafka 處理事件
* 持久化營運資料
* 視覺化機台狀態
* 產生 AI 驅動的營運摘要

MVP 的重點是**可展示性**、**簡單性**與**未來可擴充性**。

---

# 使用者故事

身為工廠操作員，我想要監控機台狀態與近期工廠事件，以便快速掌握目前的營運狀況，並獲得 AI 輔助的洞察。

---

# 功能範圍

## 儀表板（Dashboard）

顯示目前的工廠總覽。

### 需求

* 工廠總覽
* 運轉中機台數
* 警告機台數
* 嚴重異常機台數
* 生產數量
* 平均健康分數
* 近期事件
* AI 摘要卡片

---

## 機台列表（Machine List）

顯示工廠內所有機台。

### 需求

* 機台名稱
* 機台狀態
* 目前溫度
* 健康分數
* 最後更新時間

---

## 機台詳情（Machine Detail）

顯示單一機台的詳細資訊。

### 需求

* 機台資訊
* 目前狀態
* 健康分數
* 近期事件
* AI 摘要

---

## 事件中心（Event Center）

顯示工廠內跨所有機台產生的營運事件。

### 需求

* 事件時間軸（跨機台、最新在前）
* 機台
* 事件類型
* 時間戳記

篩選功能在 MVP 為選配。

### 為什麼沒有 Severity 欄位

本節較早的草稿曾包含 `Severity` 欄位。那是個錯誤：severity 不是原始事件的屬性，而是 Alert Service 對事件的*詮釋*（`docs/design/event-schema.md` §3.2 — `eventType`/`payload` 是事實，`severity`/`alert`/`machine status` 是詮釋）。而且不是每個事件都會產生詮釋 — 未超過閾值的 `TEMPERATURE_REPORTED` 或任何 `PRODUCTION_COMPLETED` 永遠不會建立告警（見下方「告警規則」表），這些列的「Severity」格子將無內容可顯示。

把衍生出的 severity 附加到原始事件流上，也意味著告警規則一旦變更（例如 Phase 2 的 Rule Engine 出現後），就能回溯地為歷史事件重新上色，這會破壞 `event-schema.md` 刻意維持的事實／詮釋分離。

這也呼應了工業告警管理與主流可觀測性工具都把同一個關注點拆成兩種視圖的做法：

| 領域 | 歷史紀錄（無 severity） | 可行動／帶 severity 的視圖 |
| --- | --- | --- |
| 工業（ISA-18.2 告警管理） | Event Log | Alarm List（有優先級、ACK 生命週期） |
| Datadog | Logs | Monitors |
| Prometheus | 原始 metrics | Alertmanager（規則附加 `severity` 標籤） |
| PagerDuty | Events API | Incidents（有 severity、ACK 生命週期） |
| IFOC | **Event Center**（本節） | **Alerts**（`GET /machines/:id/alerts`，`docs/design/api.md` §4.4） |

Event Center 保持為一份純粹、不帶 severity 的完整稽核軌跡；單靠 `Event Type` 就足以在 UI 上為某一列上色（例如 `ERROR_OCCURRED` 標紅），不需要衍生任何東西。需要知道「現在有什麼需要注意、有多嚴重」的人應該看 Alerts，而不是 Event Center。

---

## 模擬器（Simulator）

讓使用者模擬工廠事件。

支援的事件：

* STATUS_CHANGED
* TEMPERATURE_REPORTED
* ERROR_OCCURRED
* MAINTENANCE_REQUIRED
* PRODUCTION_COMPLETED

---

# 告警規則

Alert Service 依事件類型與 payload 推導出 severity — 原始事件沒有 `severity` 欄位（見 `docs/design/event-schema.md` §3.2）。

| 事件                  | 條件                  | 告警  | Severity |
| --------------------- | --------------------- | ----- | -------- |
| TEMPERATURE_REPORTED  | 超過閾值              | 是    | WARNING  |
| ERROR_OCCURRED        | 一律                  | 是    | CRITICAL |
| MAINTENANCE_REQUIRED  | 一律                  | 是    | WARNING  |
| STATUS_CHANGED        | 僅感測器故障          | 是    | WARNING  |
| PRODUCTION_COMPLETED  | 永不                  | 否    | —        |

---

# 機台狀態規則

| 事件                                  | 機台狀態        | 健康分數     |
| ------------------------------------- | --------------- | ------------ |
| TEMPERATURE_REPORTED（超過閾值）      | WARNING         | -10          |
| ERROR_OCCURRED                        | ERROR           | -30          |
| STATUS_CHANGED（感測器故障）          | WARNING         | -15          |
| MAINTENANCE_REQUIRED                  | MAINTENANCE     | -20          |
| PRODUCTION_COMPLETED                  | RUNNING         | +2           |

---

# 事件處理

每個模擬事件都必須走同一條處理管線。

```text
Simulator
    ↓
REST API
    ↓
Kafka
    ↓
Event Consumer
    ↓
MongoDB
    ↓
Dashboard
    ↓
AI Summary
```

---

# AI 摘要

根據近期機台事件產生簡潔的營運摘要。

能力範例：

* 說明目前的機台狀況。
* 摘要近期告警。
* 建議可能的後續行動。

MVP 只使用 LLM。

知識庫（RAG）刻意排除在外。

---

# 技術棧

## 前端

* Vue 3
* TypeScript

## 後端

* NestJS

## 資料庫

* MongoDB

## 訊息系統

* Kafka

## AI

* LLM API

## 基礎設施

* Docker Compose

---

# 不在範圍內

以下功能刻意排除在 MVP 之外。

* 身分驗證（Authentication）
* 使用者管理
* Rule Engine
* 事故管理（Incident Management）
* 通知中心
* RAG
* SOP 知識庫
* OPC UA
* PLC 整合
* Digital Twin
* Kubernetes
* 多租戶支援
* 預測性維護

---

# 完成定義（Definition of Done）

滿足以下條件時，MVP 視為完成：

* Dashboard 顯示工廠狀態。
* 機台列表可用。
* 機台詳情頁可用。
* Event Center 顯示工廠事件。
* Simulator 能產生所有支援的事件。
* 事件發布到 Kafka。
* Consumer 處理所有事件。
* 事件持久化到 MongoDB。
* 機台狀態正確更新。
* AI 摘要由近期事件產生。（Phase 1 以 mock provider 驗證；真實 LLM 在 Phase 3 — 見 `docs/product/product-roadmap.md` Phase 3。）
* 整個 demo 過程不需要手動修改資料。

---

# Demo 情境

1. 打開 Dashboard。
2. 前往 Simulator。
3. 產生一個 **TEMPERATURE_REPORTED** 事件（超過該機台的閾值）。
4. 確認事件出現在 Event Center。
5. 確認機台狀態改變。
6. 打開機台詳情頁。
7. 檢視 AI 產生的營運摘要。
8. 用其他支援的事件類型重複上述步驟。
