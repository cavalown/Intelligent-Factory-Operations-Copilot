## 修改的 Requirements

### Requirement: 溫度超過門檻時建立 WARNING alert

系統必須在消費到一個 `temperatureExceedsThreshold` 欄位為 `true` 的 `TEMPERATURE_REPORTED` 事件時,依照 `CLAUDE.md` 與 `docs/design/architecture.md` §9.3 的 Alert Rules,建立一筆 `severity: WARNING`、`status: ACTIVE` 的 alert。Alert Service 從事件讀取這個分類(由 Rule Engine 只計算一次,依 `openspec/changes/add-rule-engine/design.md`),而不是自己把 `payload.temperature` 拿去跟機台的 `temperatureThreshold` 比較。

#### Scenario: 超過門檻的溫度會建立 alert
- **當** Alert Service 消費到 `M-001` 的一個 `TEMPERATURE_REPORTED` 事件,`temperatureExceedsThreshold: true`
- **則** 會建立一筆 alert 文件,`machineId: M-001`、`eventId` 對應到來源事件、`severity: WARNING`、`status: ACTIVE`,以及一段人類可讀的 `message`

### Requirement: 門檻內時不建立 alert

系統不得對一個 `temperatureExceedsThreshold` 欄位為 `false` 或缺席的 `TEMPERATURE_REPORTED` 事件建立 alert。

#### Scenario: 正常範圍溫度不會建立 alert
- **當** Alert Service 消費到一個 `temperatureExceedsThreshold: false` 的 `TEMPERATURE_REPORTED` 事件
- **則** 不會建立任何 alert 文件

### Requirement: STATUS_CHANGED 時有條件地建立 WARNING alert

系統必須在消費到一個 `isSensorFailure` 欄位為 `true` 的 `STATUS_CHANGED` 事件時建立一筆 `severity: WARNING`、`status: ACTIVE` 的 alert,並且在 `isSensorFailure` 為 `false` 時不建立 alert。Alert Service 從事件讀取這個分類(由 Rule Engine 只計算一次,依 `openspec/changes/add-rule-engine/design.md`),而不是自己檢查 `payload.currentStatus`。

#### Scenario: STATUS_CHANGED 被分類為感測器故障時建立 alert
- **當** Alert Service 消費到一個 `isSensorFailure: true` 的 `STATUS_CHANGED` 事件
- **則** 會建立一筆 `severity: WARNING`、`status: ACTIVE` 的 alert 文件

#### Scenario: STATUS_CHANGED 沒被分類為感測器故障時不建立 alert
- **當** Alert Service 消費到一個 `isSensorFailure: false` 的 `STATUS_CHANGED` 事件
- **則** 不會建立任何 alert 文件
