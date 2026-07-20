## 新增 Requirements

### Requirement: 每個消費到的事件都會被重新發布到富化後的 topic

系統必須對每個從 `machine.events` 消費到的事件,以同一個 `machineId` 為鍵,重新發布到 `machine.events.enriched`,保留原始 envelope 的每一個欄位(包含 `eventId`)不變 —— 這樣依賴每機台保序與 `eventId` 鍵控冪等性的下游 consumer,才能看到跟直接訂閱 `machine.events` 時一樣的保證。

#### Scenario: 事件被重新發布,身分保持不變
- **當** Rule Engine 消費到一個 `eventId: "evt_001"`、`machineId: "M-001"` 的事件
- **則** 一個 `eventId: "evt_001"` 的事件會被發布到 `machine.events.enriched`,以 `M-001` 為鍵,原始的每個欄位都不變

#### Scenario: 每機台保序端到端保留
- **當** Rule Engine 依某個順序消費到同一個 `machineId` 的兩個事件
- **則** 對應的富化事件會依同樣的相對順序發布到 `machine.events.enriched`,以同一個 `machineId` 為鍵

### Requirement: 溫度超過門檻的分類

系統必須在重新發布一個 `TEMPERATURE_REPORTED` 事件時,加上一個 `temperatureExceedsThreshold: boolean` 欄位,設為 `payload.temperature` 是否超過該機台目前的 `temperatureThreshold`,依 `docs/design/machine-schema.md` §5.4 已知的重複條件式。

#### Scenario: 超過門檻的溫度被分類為 true
- **當** Rule Engine 消費到 `M-001` 的一個 `TEMPERATURE_REPORTED` 事件,`temperature` 高於 `M-001` 的 `temperatureThreshold`
- **則** 重新發布的事件帶著 `temperatureExceedsThreshold: true`

#### Scenario: 門檻內的溫度被分類為 false
- **當** Rule Engine 消費到一個 `TEMPERATURE_REPORTED` 事件,`temperature` 等於或低於該機台的 `temperatureThreshold`
- **則** 重新發布的事件帶著 `temperatureExceedsThreshold: false`

### Requirement: 感測器故障的分類

系統必須在重新發布一個 `STATUS_CHANGED` 事件時,加上一個 `isSensorFailure: boolean` 欄位,當 `payload.currentStatus` 為 `WARNING` 時設為 `true`,其他任何 `currentStatus` 值都設為 `false`,依這個專案既有的感測器故障慣例(`docs/design/machine-schema.md` §7)。

#### Scenario: STATUS_CHANGED 變為 WARNING 被分類為感測器故障
- **當** Rule Engine 消費到一個 `payload.currentStatus: "WARNING"` 的 `STATUS_CHANGED` 事件
- **則** 重新發布的事件帶著 `isSensorFailure: true`

#### Scenario: STATUS_CHANGED 變為非 WARNING 的狀態不是感測器故障
- **當** Rule Engine 消費到一個 `payload.currentStatus: "RUNNING"` 的 `STATUS_CHANGED` 事件
- **則** 重新發布的事件帶著 `isSensorFailure: false`

### Requirement: 分類欄位在不適用的地方會被省略

系統不得對任何 `eventType` 不是 `TEMPERATURE_REPORTED` 的事件加上 `temperatureExceedsThreshold`,也不得對任何 `eventType` 不是 `STATUS_CHANGED` 的事件加上 `isSensorFailure`。

#### Scenario: 無關的事件類型兩個分類欄位都沒有
- **當** Rule Engine 重新發布一個 `ERROR_OCCURRED`、`MAINTENANCE_REQUIRED`,或 `PRODUCTION_COMPLETED` 事件
- **則** 重新發布的事件既沒有 `temperatureExceedsThreshold` 也沒有 `isSensorFailure`

### Requirement: 未知機台會被未分類地重新發布,而不是被丟棄

系統必須仍然重新發布一個引用了沒有對應機台文件的 `machineId` 的 `TEMPERATURE_REPORTED` 事件,省略 `temperatureExceedsThreshold` 而不是丟棄這個事件 —— 下游 consumer 已經把未知的 `machineId` 當成自己的 no-op 略過來處理。

#### Scenario: 未知機台的事件被未分類地直通
- **當** Rule Engine 消費到一個 `machineId` 沒有對應機台文件的 `TEMPERATURE_REPORTED` 事件
- **則** 這個事件仍然會以同一個 `eventId`/`machineId` 被重新發布到 `machine.events.enriched`,不帶 `temperatureExceedsThreshold` 欄位
