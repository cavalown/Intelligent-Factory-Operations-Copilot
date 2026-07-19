# 回顧紀錄（Retrospectives）

針對建置 IFOC 過程中真實錯誤的事後檢討 — 重點不是「什麼壞了」，而是**為什麼會發生**，讓同一個根因不會在之後產生另一個不同的 bug。當 `/code-review` 或設計翻案抓到某個應該被理解、而不只是被修補的問題時撰寫。

這與 `docs/decisions/` 是不同種類的文件（ADR 記錄*為什麼做了某個選擇*，面向未來）— 回顧紀錄記錄*為什麼犯了某個錯誤*，所以本質上面向過去，談的是流程而非架構。

| 文件 | 說明 |
| --- | --- |
| [`2026-07-backend-implementation-lessons.md`](2026-07-backend-implementation-lessons.md) | 初版後端建置期間的 3 輪 `/code-review`，以及一次完整的架構翻案（Kafka consumer 重試邏輯）。5 個根因模式，多數與驗證方法論有關，而非單純的寫程式失誤。 |
| [`2026-07-dashboard-metrics-review-lessons.md`](2026-07-dashboard-metrics-review-lessons.md) | dashboard-operational-metrics 變更的 `/code-review`（10 個確認的發現）。4 個根因模式，最重要的是主投影關鍵路徑上的次要寫入與 poison-pill 分類器交互作用，導致事件永久遺失 — 兩個各自正確的機制以破壞性的方式組合。 |
| [`2026-07-observability-review-lessons.md`](2026-07-observability-review-lessons.md) | add-observability 變更的 `/code-review`（7 個確認的發現）。5 個根因模式，其中兩個是本文件庫先前已寫下的模式的直接重演 — 核心教訓是「把一個模式寫下來一次」不足以阻止它在不同檔案裡以不同形狀重新發生。 |

## 什麼時候新增

在任何 `/code-review` 找到共享同一個值得命名的根因的 CONFIRMED bug 之後，或在某個設計決策於實作後被翻案之後。不為沒有可泛化教訓的例行 bug 修復而寫 — 門檻是「如果不寫下來，未來的 agent（或同一個）會不會再犯這一類完全相同的錯」。
