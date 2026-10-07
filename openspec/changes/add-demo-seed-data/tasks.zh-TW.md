## 1. Demo 機台 Roster

- [x] 1.1 在具冪等性的 backend demo-machine roster 加入五個多樣化 profile。
- [x] 1.2 新增測試，證明 roster 至少包含八台唯一機台，且保留現有投影狀態。

## 2. 精選事件 Seed

- [x] 2.1 實作無外部相依的 host script，包含涵蓋每種 MVP event type 與多種最終機台狀態的精選事件。
- [x] 2.2 新增 API readiness／roster 驗證、分頁探索既有事件、逐事件跳過與可採取行動的失敗訊息。
- [x] 2.3 將 script 暴露為 `npm run seed:demo`，並為 dataset 有效性、部分重跑與失敗行為新增自動化測試。

## 3. 文件與驗證

- [x] 3.1 在英文與正體中文的本機開發及 Compose 指南中說明 demo seed 流程。
- [x] 3.2 執行 backend tests／build、seed-script tests 與 strict OpenSpec validation。
- [x] 3.3 對本機 Compose stack 執行 seed，驗證機台數、全部五種 event type、多樣狀態、告警與安全重跑行為。
