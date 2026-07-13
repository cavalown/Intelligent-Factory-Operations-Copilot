# ADR-0004：直接 LLM 摘要先於 RAG 交付

## 狀態

已接受（Accepted）

## 脈絡

IFOC 的產品目標包含 AI 輔助的營運洞察 — 解釋近期機台事件的意義並建議後續行動（`docs/design/architecture.md` §7.6）。完整的檢索增強生成（RAG）實作可以讓 Insight Service 把回答扎根在 SOP 知識庫、歷史事故模式與維護紀錄上。但那個知識庫還不存在，而建立它（擷取管線、切塊、嵌入、向量儲存、檢索調校）本身就是可觀的範圍。

MVP 的目標是端到端證明完整的事件驅動管線 — 模擬、串流、持久化、投影、解釋 — 不讓任何單一能力變成拖住其他一切的最長桿（`docs/product/mvp.md`）。

## 決策

MVP 的 Insight Service 直接呼叫 LLM API，脈絡由 `machine_events`、`machines` 與 `alerts` 組裝的近期事件／機台／告警內容構成（`docs/design/architecture.md` §9.4）。MVP 不建 RAG、向量儲存或 SOP 知識庫。RAG 延後到 `docs/product/product-roadmap.md` Phase 3（Operational Intelligence）。

## 後果

**變容易的：**

* 只要 Event/Machine/Alert 資料存在，AI 的價值就能展示 — 不必先完成一個獨立的知識庫擷取專案。
* Insight Service 的依賴面保持很小：讀三個既有的 MongoDB collection、呼叫一個外部 LLM API，符合 `CLAUDE.md` 的原則「AI 解釋資料，不取代資料」。
* AI 摘要仍可追溯到 `inputEventIds`（`api.md` §5.4），不需要同時引用檢索到的文件。

**變困難的：**

* 沒有 SOP 或歷史事故的扎根，摘要只能從近期原始事件推理 — 無法回答「上次我們怎麼修的」，也無法引用成文的程序。這個能力要到 Phase 3 才存在。
* 提示詞脈絡是從臨時蒐集的近期事件／狀態／告警組出來的；沒有檢索相關性機制，所以隨著事件量成長，脈絡挑選邏輯（要納入哪些事件）在 Phase 3 到來之前需要自己的設計關注。

## 曾考慮的替代方案

* **把 RAG 做進 MVP** — 能立即產出品質更高、更有依據的摘要，但需要一個不存在的知識庫（SOP 尚未撰寫或數位化），以及部署故事（`architecture.md` §13.1：Docker Compose、無 Kubernetes）目前不包含的向量儲存。否決原因：這會讓 AI 基礎設施成為 MVP 的關鍵路徑，而 MVP 的首要目標是證明事件管線。
* **MVP 完全不含 AI** — 最簡單，把所有 AI 複雜度延到後期階段。否決原因：AI 輔助洞察是產品目標中明列的一部分（`architecture.md` §1），而直接 LLM 摘要的成本夠低，值得現在納入以端到端驗證概念。
