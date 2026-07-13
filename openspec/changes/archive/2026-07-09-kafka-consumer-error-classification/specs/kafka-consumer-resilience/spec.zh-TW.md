## 新增的需求

### 需求：consumer 錯誤邊界只吞資料錯誤；其他錯誤傳播給 kafkajs 自身的重試處理
系統 SHALL 只在錯誤表示訊息內容本身不可處理（JSON 解析失敗，或 Mongoose 驗證/轉型錯誤）時吞掉（記錄並跳過、提交 offset）`handleMessage` 的失敗。任何其他錯誤 SHALL 重新拋出，讓它抵達 kafkajs 自身的 consumer 層重試機制，而不是由 `handleMessage` 呼叫者內的應用層邏輯來重試。

#### 情境：格式錯誤的訊息立即跳過，無重試延遲
- **WHEN** `handleMessage` 拋出 `SyntaxError`（無效 JSON）或 Mongoose `ValidationError`/`CastError`
- **THEN** 消費的服務記錄錯誤並立即繼續處理下一則訊息，不增加任何延遲

#### 情境：非資料錯誤傳播到 kafkajs 的重試機制
- **WHEN** `handleMessage` 拋出的錯誤不是 `SyntaxError`、Mongoose `ValidationError` 或 Mongoose `CastError`（例如暫時性的 MongoDB 連線失敗）
- **THEN** 錯誤傳播出 consumer 的 `eachMessage` callback，由 kafkajs 自身的 consumer 層重試機制重試，只有在 kafkajs 自身的重試額度耗盡時才導致程序崩潰（可經容器重啟與 Kafka 重送復原）

本需求一致地適用於 `EventConsumerService`、`MachineProjectionConsumerService` 與 `AlertConsumerService`，因為三者都繼承同一個 `KafkaConsumerBase`，且分類是在抽象的 `handleMessage` 呼叫周圍以通用方式進行。
