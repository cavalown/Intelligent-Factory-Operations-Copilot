# 文件導覽（Documentation Index）

這是 IFOC（Intelligent Factory Operations Copilot，智慧工廠營運助理）所有設計與產品文件的導覽頁。

專案目前處於**設計階段**。尚無任何應用程式程式碼 — `docs/` 底下的所有內容定義了將要建造的東西。如果你剛接觸本專案，請從 `product/mvp.md` 與 `design/architecture.md` 開始。

---

## 狀態圖例

| 符號 | 意義 |
| --- | --- |
| ✅ | 已撰寫且為最新 |
| 📝 | 已規劃，檔案存在但為空 |
| 🔜 | 已規劃，檔案尚未建立 |
| 🔮 | 未來階段，尚未開始 |

---

## 產品文件

定義 IFOC 是什麼、MVP 範圍涵蓋哪些內容。

| 文件 | 狀態 | 說明 |
| --- | --- | --- |
| [`product/product-roadmap.md`](product/product-roadmap.md) | ✅ | 長期五階段路線圖（Foundation → Digital Twin）。 |
| [`product/mvp.md`](product/mvp.md) | ✅ | MVP 功能範圍、機台狀態規則、完成定義（definition of done）。 |

## 系統設計

定義 IFOC 如何建造。

| 文件 | 狀態 | 說明 |
| --- | --- | --- |
| [`design/architecture.md`](design/architecture.md) | ✅ | 整體系統架構、元件、資料流、部署。 |
| [`design/event-schema.md`](design/event-schema.md) | ✅ | 事件信封（envelope）、payload 綱要、producer/consumer 契約、版本管理。 |
| [`design/api.md`](design/api.md) | ✅ | 後端、儀表板與模擬器之間的 REST API 契約。 |
| [`design/machine-schema.md`](design/machine-schema.md) | ✅ | 機台領域模型 — 投影（projection）欄位、狀態轉移、健康分數規則。 |
| [`design/event-flow.md`](design/event-flow.md) | ✅ | 完整範例 — 單一事件的完整生命週期，從模擬器觸發、經過所有 consumer、到 AI 摘要。與 architecture.md §9–10 互補而不重複。 |
| [`design/database.md`](design/database.md) | 🔮 | 未來：詳細的 MongoDB 綱要、索引與查詢模式。 |
| [`design/ai-design.md`](design/ai-design.md) | 🔮 | 未來：Insight Service 提示詞設計、RAG 架構（Phase 3）。 |
| [`design/security.md`](design/security.md) | 🔮 | 未來：身分驗證、授權、機密管理。 |

## 架構決策

記錄重大技術選擇原因的簡短紀錄。

| 文件 | 狀態 | 說明 |
| --- | --- | --- |
| [`decisions/README.md`](decisions/README.md) | ✅ | ADR 撰寫指引與索引。 |
| [`decisions/ADR-0001-use-kafka.md`](decisions/ADR-0001-use-kafka.md) | ✅ | 為什麼選擇 Kafka 作為事件骨幹。 |
| [`decisions/ADR-0002-use-mongodb.md`](decisions/ADR-0002-use-mongodb.md) | ✅ | 為什麼選擇 MongoDB 存放事件與投影。 |
| [`decisions/ADR-0003-rest-api.md`](decisions/ADR-0003-rest-api.md) | ✅ | 為什麼 MVP 選擇 REST 而非 GraphQL。 |
| [`decisions/ADR-0004-ai-summary-before-rag.md`](decisions/ADR-0004-ai-summary-before-rag.md) | ✅ | 為什麼直接 LLM 摘要先於 RAG 交付。 |

`design/architecture.md` §18 維護一張每個決策一行的濃縮摘要表；這些 ADR 檔案則是每一列背後完整的脈絡、替代方案與後果。

## 回顧紀錄（Retrospectives）

針對真實實作錯誤及其根本原因的事後檢討 — 不是 ADR（ADR 記錄為什麼做了某個選擇），而是記錄為什麼犯了某個錯誤，以避免重蹈覆轍。

| 文件 | 狀態 | 說明 |
| --- | --- | --- |
| [`retrospectives/README.md`](retrospectives/README.md) | ✅ | 索引與新增回顧紀錄的標準。 |
| [`retrospectives/2026-07-backend-implementation-lessons.md`](retrospectives/2026-07-backend-implementation-lessons.md) | ✅ | 初版後端建置期間，3 輪 `/code-review` 與一次架構翻案中歸納出的 5 個根因模式。 |
| [`retrospectives/2026-07-dashboard-metrics-review-lessons.md`](retrospectives/2026-07-dashboard-metrics-review-lessons.md) | ✅ | dashboard-operational-metrics 審查歸納出的 4 個根因模式：關鍵路徑上的次要寫入 × poison-pill 分類、對弱驗證欄位的複合假設、過期的文件註冊表、無聲的降級模式。 |

## 部署

| 文件 | 狀態 | 說明 |
| --- | --- | --- |
| [`deployment/local-development.md`](deployment/local-development.md) | ✅ | 不透過 Docker Compose 的本機開發環境設定。 |
| [`deployment/docker-compose.md`](deployment/docker-compose.md) | ✅ | Docker Compose 服務、埠號、環境變數。 |
| `deployment/kubernetes.md` | 🔮 | 未來：正式環境 Kubernetes 部署（明確不在 MVP 範圍內）。 |

## 資產（Assets）

全部 5 張規劃中的圖表都以 Mermaid（`.mmd`）原始檔存在於 `docs/assets/mermaid/` 底下。目前尚無 `.drawio`/`.png`/`.svg` 匯出檔 — 只有在實際製作簡報或 README 圖片時才需要。每份文字文件仍保留原本的 ASCII 版本，並附上 `.mmd` 檔的連結（為什麼不合併，見下方「圖表工作流程」）。

### 圖表工作流程

每張圖表的唯一真實來源（source of truth）是 `docs/assets/mermaid/<name>.mmd` 底下的獨立 Mermaid 檔案 — 一張圖一個檔案，之後可以餵給 `mmdc`（mermaid-cli）或 draw.io 的 Mermaid 匯入功能，產出 `.svg`/`.png`/`.drawio`，不必手動重繪。

對應的文字文件（例如 `architecture.md`）是連結到 `.mmd` 檔，而不是嵌入其內容。這是刻意的取捨，不是疏漏：純 Markdown 沒有檔案引入（transclusion）語法，而 GitHub 只會渲染實際寫在 `.md` 檔內的 ` ```mermaid ` 圍欄區塊 — 連到獨立 `.mmd` 檔的連結在 GitHub 上打開只會顯示純文字，不是圖。要看渲染後的圖需要支援 Mermaid 的工具（VS Code 的 Mermaid 預覽、mermaid.live 等）。之所以這樣選，是為了避免把 Mermaid 原始碼複製進文件的圍欄區塊後，兩份拷貝逐漸失去同步。

| 優先級 | 圖表 | 狀態 | 依據來源 | 規劃的原始檔 |
| --- | --- | --- | --- | --- |
| 高 | 系統架構 | ✅ | `design/architecture.md` §5（High-Level Architecture） | [`assets/mermaid/architecture.mmd`](assets/mermaid/architecture.mmd) — 僅 Phase 1/MVP 快照，範圍註記見檔案內 |
| 高 | 事件流程時序圖 | ✅ | `design/event-flow.md`（完整範例） | [`assets/mermaid/event-flow.mmd`](assets/mermaid/event-flow.mmd) |
| 中 | 部署拓撲 | ✅ | `design/architecture.md` §13、`deployment/docker-compose.md` | [`assets/mermaid/deployment-topology.mmd`](assets/mermaid/deployment-topology.mmd) |
| 中 | 機台狀態狀態圖 | ✅ | `design/machine-schema.md` §4 | [`assets/mermaid/machine-status-state.mmd`](assets/mermaid/machine-status-state.mmd) |
| 低 | 路線圖演進圖 | ✅ | `product/product-roadmap.md`（「Future Vision」） | [`assets/mermaid/roadmap-evolution.mmd`](assets/mermaid/roadmap-evolution.mmd) |

| 路徑 | 狀態 | 說明 |
| --- | --- | --- |
| `assets/screenshots/` | 🔜 | 用於 demo 與文件的儀表板截圖 — 前端存在之前不適用。 |

---

## 建議閱讀順序

1. `product/mvp.md` — MVP 做什麼、為什麼。
2. `design/architecture.md` — 系統如何組織。
3. `design/event-schema.md` — 所有模組都依賴的事件契約。
4. `design/machine-schema.md` — 事件如何轉成機台狀態。
5. `design/api.md` — 前端與模擬器如何跟後端溝通。
6. `design/event-flow.md` — 單一事件走完整個系統，把 3–5 串起來。
7. `product/product-roadmap.md` — MVP 之後專案要往哪走。

`decisions/` 與 `deployment/` 不在這個循序閱讀清單裡 — 把它們當參考資料：想知道某個選擇的原因時打開 ADR，實際要跑系統時打開 `deployment/`。

## 相關的頂層指引

* [`/CLAUDE.md`](../CLAUDE.md) — 給 AI 程式助理的濃縮專案指引；與上述文件保持同步。
