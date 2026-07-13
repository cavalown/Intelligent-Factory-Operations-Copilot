## 新增的需求

### 需求：consumer 錯誤邊界防止無限期停滯
系統 SHALL 接住 consumer 的 `handleMessage` 處理單一 Kafka 訊息時拋出的任何錯誤、記錄它，並讓 consumer 繼續處理後續訊息，而不是讓錯誤傳播出去、無限期地阻塞 consumer group。

#### 情境：格式錯誤的 JSON 不會讓 consumer 停滯
- **WHEN** `machine.events` 上的一則訊息不是合法 JSON
- **THEN** 消費的服務記錄解析失敗並繼續處理下一則訊息，不會無限期重試該格式錯誤的訊息

#### 情境：下游持久化錯誤不會讓 consumer 停滯
- **WHEN** `handleMessage` 在持久化訊息時拋出（例如與 duplicate-key 冪等性無關的 MongoDB 驗證錯誤）
- **THEN** 消費的服務記錄錯誤並繼續處理下一則訊息

本需求一致地適用於 `EventConsumerService`、`MachineProjectionConsumerService` 與 `AlertConsumerService`，因為三者都繼承同一個 `KafkaConsumerBase`。
