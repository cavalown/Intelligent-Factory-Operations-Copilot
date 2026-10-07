## 原因

Dashboard 目前在全新環境中只有三台閒置機台，且沒有事件歷史，因此多數卡片、狀態分布、告警與事件畫面顯得空白。可重現的 demo 資料 seed 能提供足夠多樣且內部一致的資料，無需手動逐筆操作表單即可呈現產品價值。

## 變更內容

- 擴充固定 demo 機台 roster，加入更多不同設備類型與溫度門檻的機台 profile。
- 新增明確指令，透過既有 Simulator API 發布一組精選的有效事件，讓 Kafka consumers 依正常流程建立事件歷史、機台投影、告警、狀態轉換與 Dashboard 指標。
- 透過發布前檢查固定 event identifier，讓 demo event seed 可安全重複執行。
- 說明 Compose stack 啟動後如何載入 demo dataset。

## 能力

### 新增能力

- `demo-data-seeding`：定義用來填入全新本機 Dashboard 的可重現機台 roster 與選用式事件 dataset。

### 修改能力

無。

## 影響

- Backend 機台 seed roster 與 package scripts。
- 新增一個無外部相依的 Node.js demo seed script，呼叫既有 HTTP API。
- 本機開發與 Docker Compose 文件。
- 不變更 API、event schema、persistence schema 或 production runtime 行為。
