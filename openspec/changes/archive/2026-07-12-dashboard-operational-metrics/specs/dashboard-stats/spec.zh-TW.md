# dashboard-stats 規格（delta）

## 新增的需求

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
