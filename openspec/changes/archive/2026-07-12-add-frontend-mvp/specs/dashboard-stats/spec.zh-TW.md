# dashboard-stats 規格（delta）

## 新增的需求

### 需求：全工廠統計以單一聚合提供
系統 SHALL 曝露 `GET /dashboard/stats`，回傳各狀態的機台數（五種狀態一律存在、以零填滿）、`machineCount`、`totalProductionCount` 與 `averageHealthScore`，從 `machines` 投影聚合。

#### 情境：統計反映目前投影
- **WHEN** 存在多種狀態的機台時，客戶端 GET `/dashboard/stats`
- **THEN** 回應包含 `statusCounts`，`RUNNING`、`IDLE`、`WARNING`、`ERROR`、`MAINTENANCE` 每一種各有一項（沒有機台為該狀態時為 0），加上 `machineCount`、`totalProductionCount`（總和）與 `averageHealthScore`（平均）

#### 情境：machines collection 為空
- **WHEN** 沒有任何機台時，客戶端 GET `/dashboard/stats`
- **THEN** 回應為 `machineCount: 0`、以零填滿的 `statusCounts`、`totalProductionCount: 0`，以及 `averageHealthScore: null`

#### 情境：事件處理後統計改變
- **WHEN** 某機台的狀態投影改變（例如超過閾值的 `TEMPERATURE_REPORTED` 使它進入 `WARNING`），且客戶端重新取得 `/dashboard/stats`
- **THEN** 回傳的 `statusCounts` 反映新的狀態分布
