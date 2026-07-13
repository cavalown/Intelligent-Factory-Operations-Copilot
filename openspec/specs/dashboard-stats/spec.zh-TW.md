# dashboard-stats 規格

## 目的
提供 Dashboard 統計磚背後的全工廠聚合 — 各狀態的機台數、生產總量與平均健康分數 — 從 `machines` 投影計算並以單一讀取（`GET /dashboard/stats`）曝露，讓聚合放在 API 後面，而不是客戶端算術。由變更 `add-frontend-mvp`（2026-07-11）引入。

## 需求

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

### 需求：統計包含滾動 24 小時的營運聚合
`GET /dashboard/stats` 的回應 SHALL 額外包含一個 `last24h` 物件，內含 `productionCount`（`occurredAt` 落在 `[now − 24h, now]` 的 `PRODUCTION_COMPLETED` 事件 `payload.quantity` 的總和）與全工廠的 `operatingMs` / `stoppedMs` / `idleMs`（各機台稼働率時間桶的總和）。此新增 SHALL 向後相容：所有先前規格化的欄位維持不變。

#### 情境：24 小時生產量由事件計算
- **WHEN** 過去 24 小時內發生了數量 3 與 4 的兩個 `PRODUCTION_COMPLETED` 事件，且視窗外存在更舊的事件
- **THEN** `last24h.productionCount` 為 `7`

#### 情境：工廠稼働率為各機台加總
- **WHEN** 每台機台的 24 小時稼働率皆已知
- **THEN** `last24h.operatingMs`/`stoppedMs`/`idleMs` 等於跨機台的總和

#### 情境：空工廠
- **WHEN** 沒有任何機台
- **THEN** `last24h` 四個欄位皆回報零
