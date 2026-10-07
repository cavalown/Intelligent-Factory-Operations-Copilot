## 目的

提供選用、可重現的本機 dataset，讓全新 demo 環境中的 Dashboard 機台、事件、告警、生產、健康度與稼動率畫面具有足夠展示內容。

## 新增需求

### 需求：全新環境包含多樣化的 demo 機台 roster
系統 SHALL seed 至少八台具有唯一識別碼、易讀名稱與有效溫度門檻的 demo 機台。應用程式再次啟動時，MUST NOT 重設既有機台的投影欄位。

#### 情境：全新資料庫取得完整 roster
- **WHEN** backend 對空白資料庫啟動
- **THEN** 機台清單包含至少八台具有唯一 `machineId` 的 demo 機台

#### 情境：重新啟動保留現有機台狀態
- **WHEN** 事件已改變 seed 機台的狀態、健康度、溫度或生產數量後，backend 重新啟動
- **THEN** seed 流程不變更這些投影值

### 需求：Demo 事件使用正常 ingestion 路徑
專案 SHALL 提供明確的本機指令，透過既有 Simulator API 提交精選 dataset，而不是直接寫入衍生 collection。Dataset MUST 包含多台機台及五種 MVP event type 的混合事件。

#### 情境：Seed 一致地填入 Dashboard 資料
- **WHEN** 操作者對已就緒且具有擴充機台 roster 的 backend 執行 demo-data 指令
- **THEN** 事件透過 Simulator API 被接受，且下游 consumers 可建立事件歷史、機台投影、告警、狀態轉換與 Dashboard 聚合資料

### 需求：可安全重跑 demo event seed
Demo-data 指令 SHALL 偵測事件歷史中已存在的 event identifier，並跳過這些事件而不再次發布。

#### 情境：完整 dataset 已存在
- **WHEN** 所有精選事件都已持久化後，操作者再次執行 demo-data 指令
- **THEN** 指令不發布重複事件，並回報已跳過現有事件

#### 情境：存在部分載入的 dataset
- **WHEN** 部分精選 event identifier 已存在而其他不存在
- **THEN** 指令只發布缺少的事件

### 需求：Seed 失敗訊息可採取行動
當 backend 無法連線、缺少必要 demo 機台或 API 拒絕事件時，demo-data 指令 MUST 以非零狀態退出並顯示清楚訊息。

#### 情境：Backend 未執行
- **WHEN** 操作者在設定的 API base URL 無法連線時執行指令
- **THEN** 指令以失敗狀態退出，並告知無法連線的 API URL

