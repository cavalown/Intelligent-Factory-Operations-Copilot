# ai-summary 規格（delta）

## 新增的需求

### 需求：隨需產生機台範圍的 AI 摘要
系統在收到 `POST /machines/:id/summary` 時，SHALL 同步蒐集該機台目前狀態、近期事件與告警，呼叫所設定的 LLM，把結果以 `scope: "MACHINE"` 持久化到 `ai_summaries`，並在回應中回傳新摘要，依 `docs/design/api.md` §4.7。

#### 情境：機台摘要產生成功
- **WHEN** 客戶端 POST `/machines/M-001/summary` 且 LLM 呼叫成功
- **THEN** 一份文件存入 `ai_summaries`，帶有 `machineId: "M-001"`、`scope: "MACHINE"`、非空的 `summary`、`recommendedActions` 陣列、`model`、`inputEventIds` 與 `createdAt`，且回應主體就是該摘要

#### 情境：未知機台回傳 404
- **WHEN** 客戶端對不存在的 `machineId` POST `/machines/:id/summary`
- **THEN** 系統回應 `404`、錯誤代碼 `MACHINE_NOT_FOUND`，且不呼叫 LLM

### 需求：隨需產生工廠範圍的 AI 摘要
系統在收到 `POST /summary` 時，SHALL 同步蒐集所有機台的目前狀態、近期跨機台事件與告警，呼叫所設定的 LLM，把結果以 `scope: "FACTORY"` 且不含 `machineId` 持久化到 `ai_summaries`，並在回應中回傳新摘要。

#### 情境：工廠摘要產生成功
- **WHEN** 客戶端 POST `/summary` 且 LLM 呼叫成功
- **THEN** 一份文件存入 `ai_summaries`，帶有 `scope: "FACTORY"`、無 `machineId`、非空的 `summary`、`recommendedActions` 陣列、`model`、`inputEventIds` 與 `createdAt`，且回應主體就是該摘要

### 需求：提供最新已存摘要而不呼叫 LLM
系統在收到 `GET /machines/:id/summary` 與 `GET /summary` 時，SHALL 回傳該範圍（機台範圍還要對應該機台）最近建立的 `ai_summaries` 文件，而不呼叫 LLM。

#### 情境：回傳最新的機台摘要
- **WHEN** 客戶端 GET `/machines/M-001/summary` 且 `M-001` 存在摘要
- **THEN** 回傳 `M-001` 最近的 `scope: "MACHINE"` 摘要，回應形狀依 `docs/design/api.md` §4.6

#### 情境：回傳最新的工廠摘要
- **WHEN** 客戶端 GET `/summary` 且存在工廠範圍摘要
- **THEN** 回傳最近的 `scope: "FACTORY"` 摘要

#### 情境：尚無摘要回傳 404
- **WHEN** 客戶端 GET `/machines/M-001/summary`（或 `/summary`）且該範圍/機台從未產生過摘要
- **THEN** 系統回應 `404`、錯誤代碼 `SUMMARY_NOT_FOUND`

#### 情境：GET 時未知機台回傳 404
- **WHEN** 客戶端對不存在的 `machineId` GET `/machines/:id/summary`
- **THEN** 系統回應 `404`、錯誤代碼 `MACHINE_NOT_FOUND`

### 需求：LLM 失敗被隔離並回傳 502
當上游 LLM 呼叫失敗或其輸出無法解析成摘要形狀時，系統 SHALL 回應 `502`、錯誤代碼 `LLM_CALL_FAILED`，SHALL NOT 為該次嘗試持久化任何文件，且 SHALL NOT 影響機台、事件或告警端點的可用性。

#### 情境：LLM 呼叫失敗
- **WHEN** 客戶端 POST `/machines/M-001/summary`（或 `/summary`）且 LLM 呼叫出錯、逾時或回傳無法解析的輸出
- **THEN** 系統回應 `502`、錯誤代碼 `LLM_CALL_FAILED`，且不建立新的 `ai_summaries` 文件

#### 情境：先前存的摘要在重新產生失敗後仍在
- **WHEN** 已存在一份摘要，且後續的 POST 以 `LLM_CALL_FAILED` 失敗
- **THEN** 對同一範圍的 GET 仍回傳先前儲存的摘要

### 需求：摘要可追溯到其輸入事件
系統 SHALL 在每份 `ai_summaries` 文件中記錄其內容被提供給 LLM 的事件的 `inputEventIds`，依關鍵設計規則 3（AI 解釋資料，不取代資料）。

#### 情境：inputEventIds 引用真實事件
- **WHEN** 從包含事件的脈絡產生摘要
- **THEN** 儲存文件的 `inputEventIds` 恰好包含被納入提示詞脈絡的事件的 `eventId`

### 需求：LLM provider 由環境設定選擇
系統 SHALL 在啟動時從 `LLM_PROVIDER`（搭配 `LLM_API_KEY` 與 `LLM_MODEL`）選擇 LLM adapter，且當設定的 provider 未知時 SHALL 在啟動時以清楚的錯誤快速失敗。

#### 情境：使用所設定的 provider
- **WHEN** 應用程式以支援的 `LLM_PROVIDER` 值啟動
- **THEN** 摘要產生使用該 provider 的 adapter，並把它的模型識別碼存入摘要的 `model` 欄位

#### 情境：未知 provider 快速失敗
- **WHEN** 應用程式以無法辨識的 `LLM_PROVIDER` 值啟動
- **THEN** 啟動失敗，錯誤訊息指名無效的值與支援的 provider
