# ADR-0003：MVP API 選用 REST 而非 GraphQL/gRPC

## 狀態

已接受（Accepted）

## 脈絡

API 層（`docs/design/architecture.md` §11）在 MVP 階段只有一個消費者：Vue 3 儀表板。端點面很小且固定 — 總共七個端點，列於 `docs/design/api.md` §4 — 涵蓋機台列表／詳情、事件歷史、告警，以及 AI 摘要的取得／產生。沒有行動裝置客戶端、沒有第三方 API 消費者，儀表板也不需要跨資源組合任意查詢。

## 決策

MVP API 使用 REST。端點回傳純 JSON 資源表示，遵循 `docs/design/api.md` §2 的慣例。

## 後果

**變容易的：**

* 一組小而固定的端點直接對應到儀表板頁面（`architecture.md` §7.8：工廠總覽、機台列表、機台詳情、Event Center、Simulator 控制、AI 摘要面板）— 每個頁面從一兩個明確的 URL 取資料。
* MVP 交付前不需要引入綱要／程式碼產生工具（GraphQL schema、gRPC `.proto` 檔、client 產生）。
* REST 可以直接用瀏覽器的 fetch 呼叫，不需要額外的 client 函式庫，讓 Vue 3 前端保持簡單。

**變困難的：**

* 若未來某個儀表板視圖需要在一次往返中組合多個資源的資料（例如合併式儀表板摘要），REST 要嘛需要一個專門的聚合端點，要嘛前端得發多個請求 — 沒有 GraphQL 那種隨需的查詢組合能力。
* 游標式分頁（`api.md` §4.3）與篩選慣例必須逐端點手工設計與記錄，而不是由查詢語言免費提供。

## 曾考慮的替代方案

* **GraphQL** — 很適合需要自行組合跨多種關聯資源查詢的客戶端，或多個獨立前端團隊以不同方式消費同一個 API 的情境。MVP 階段否決，因為只有一個消費者、視圖小而固定且已知 — GraphQL 的彈性解決的是 IFOC 還沒有的問題，代價卻是 MVP 不需要的 schema/resolver 基礎設施。
* **gRPC** — 很適合服務對服務的呼叫（例如未來拆分出來的 Insight Service 呼叫 Machine Service），但很不適合瀏覽器端的儀表板客戶端，那需要一層 gRPC-Web proxy。等模組化單體拆分後（`architecture.md` §14.2）如果出現內部服務對服務呼叫，再重新考慮。
