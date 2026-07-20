## 修改的 Requirements

### Requirement: 溫度超過門檻時更新投影

系統必須在消費到一個 `temperatureExceedsThreshold` 欄位為 `true` 的 `TEMPERATURE_REPORTED` 事件時,把機台的 `status` 提升到 `WARNING`(視嚴重度優先順序而定),並把 `healthScore` 減少 10,限制在 `[0, 100]` 之間,依 `docs/design/machine-schema.md` §4-§5。Machine Service 從事件讀取這個分類(由 Rule Engine 只計算一次,依 `openspec/changes/add-rule-engine/design.md`),而不是自己把 `payload.temperature` 拿去跟機台的 `temperatureThreshold` 比較。

#### Scenario: 溫度超過門檻會提升狀態並降低健康分數
- **當** Machine Service 消費到 `M-001` 的一個 `TEMPERATURE_REPORTED` 事件,`temperatureExceedsThreshold: true`,而且 `M-001` 目前狀態的嚴重度等級在 `WARNING` 或以下
- **則** `M-001` 的 `status` 變成 `WARNING`,`healthScore` 減少 10(下限為 0),`currentTemperature` 被設為回報的值,`lastEventId`/`lastUpdatedAt` 都會更新

### Requirement: 門檻內時狀態或健康分數不變

系統在一個 `TEMPERATURE_REPORTED` 事件的 `temperatureExceedsThreshold` 欄位為 `false` 或缺席時,必須只更新 `currentTemperature`、`lastEventId`,以及 `lastUpdatedAt`。

#### Scenario: 門檻內的溫度只更新遙測資料
- **當** Machine Service 消費到某台機台的一個 `TEMPERATURE_REPORTED` 事件,`temperatureExceedsThreshold: false`
- **則** 這台機台的 `status` 與 `healthScore` 保持不變,但 `currentTemperature`、`lastEventId`,以及 `lastUpdatedAt` 會更新

### Requirement: 套用 STATUS_CHANGED 健康分數規則

系統必須在消費到一個 `isSensorFailure` 欄位為 `true` 的 `STATUS_CHANGED` 事件時,把 `healthScore` 減少 15,限制在 `[0, 100]` 之間。Machine Service 從事件讀取這個分類(由 Rule Engine 只計算一次,依 `openspec/changes/add-rule-engine/design.md`),而不是自己檢查 `payload.currentStatus`。任何 `isSensorFailure: false` 的 `STATUS_CHANGED` 事件都不會因為這個事件造成健康分數變化。

#### Scenario: 被分類為感測器故障的 STATUS_CHANGED 會降低健康分數
- **當** Machine Service 消費到一個 `isSensorFailure: true` 的 `STATUS_CHANGED` 事件
- **則** 這台機台的 `healthScore` 減少 15(下限為 0)

#### Scenario: 沒被分類為感測器故障的 STATUS_CHANGED 不影響健康分數
- **當** Machine Service 消費到一個 `isSensorFailure: false` 的 `STATUS_CHANGED` 事件
- **則** 這台機台的 `healthScore` 不會因為這個事件改變
