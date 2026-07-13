# machine-utilization 規格（delta）

## 新增的需求

### 需求：狀態轉移記錄為可重建的投影
每當 machines 投影 consumer 改變機台的投影狀態時，系統 SHALL 向 `machine_status_transitions` 附加一筆紀錄 `(machineId, fromStatus, toStatus, at, eventId)`；事件未改變狀態時 SHALL NOT 記錄任何東西；且 SHALL 對 `eventId` 冪等。

#### 情境：狀態改變時記錄轉移
- **WHEN** 投影 consumer 處理一個把 `M-001` 從 `RUNNING` 移到 `WARNING` 的事件
- **THEN** 儲存一筆轉移紀錄，帶有 `machineId: M-001`、`fromStatus: RUNNING`、`toStatus: WARNING`、等於事件 `occurredAt` 的 `at`，以及觸發的 `eventId`

#### 情境：狀態不變時不記錄
- **WHEN** consumer 處理的事件不改變機台的投影狀態（例如閾值內的 `TEMPERATURE_REPORTED`）
- **THEN** 不建立轉移紀錄

#### 情境：重複事件不重複轉移
- **WHEN** consumer 處理的事件其 `eventId` 已有轉移紀錄
- **THEN** 不建立第二筆紀錄

#### 情境：轉移寫入失敗永遠不阻擋主投影
- **WHEN** 轉移寫入因 duplicate key 之外的任何原因失敗（例如某個格式錯誤欄位的驗證錯誤）
- **THEN** 失敗被記錄，且 machines 投影更新（`machine.save()`）仍然進行 — 轉移是可重建的次要投影，不得中止主投影

### 需求：每台機台的滾動 24 小時稼働率透過 HTTP 提供
系統 SHALL 曝露 `GET /machines/:id/utilization`，回傳視窗 `[now − 24h, now]` 內的 `operatingMs`（`RUNNING`+`WARNING` 的時間）、`stoppedMs`（`ERROR`+`MAINTENANCE`）與 `idleMs`（`IDLE`），由轉移投影與視窗起點時生效的狀態計算。

#### 情境：稼働率反映轉移時間軸
- **WHEN** 依其記錄的轉移，`M-001` 過去 24 小時部分時間 `RUNNING`、部分時間 `ERROR`
- **THEN** `GET /machines/M-001/utilization` 回傳的時長總和等於視窗長度，且分配與時間軸相符

#### 情境：視窗內沒有轉移
- **WHEN** 機台在視窗內沒有轉移紀錄
- **THEN** 其整個視窗歸給視窗起點時生效的狀態（沒有更早的轉移時退回目前狀態）

#### 情境：bootstrap 近似被標示
- **WHEN** 機台完全沒有轉移紀錄（使用了目前狀態的 fallback）
- **THEN** 回應帶 `approximate: true`；任一機台的視窗為近似時，儀表板聚合帶 `last24h.approximate: true`；完整推導的視窗帶 `approximate: false`

#### 情境：格式錯誤的轉移時間戳記不毒化計算
- **WHEN** 某筆已儲存轉移的 `at` 無法解析為時間戳記
- **THEN** 該轉移被跳過並記錄，回傳的時長仍是有限數值

#### 情境：未知機台回傳 404
- **WHEN** 客戶端對不存在的 `machineId` GET `/machines/:id/utilization`
- **THEN** 系統回應 `404`、錯誤代碼 `MACHINE_NOT_FOUND`
