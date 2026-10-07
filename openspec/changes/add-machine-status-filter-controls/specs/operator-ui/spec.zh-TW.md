## 新增需求

### 需求：Machine List 提供直接狀態篩選
Machine List SHALL 提供 All、Running、Idle、Warning、Error 與 Maintenance 控制，各選項顯示目前機台數。選擇狀態 SHALL 更新既有 `?status=` URL state 並篩選清單；從 Dashboard 帶入的 URL state SHALL 選中對應控制。

#### 情境：操作員直接在 Machines 篩選
- **WHEN** 操作員在 Machine List 選擇 Warning
- **THEN** 只顯示 `WARNING` 機台、Warning control 被選中，且 URL 包含 `?status=WARNING`

#### 情境：Dashboard drill-down 選中控制
- **WHEN** 操作員從 Dashboard Critical 到達 `/machines?status=ERROR`
- **THEN** Error control 被選中，且只顯示 `ERROR` 機台

#### 情境：響應式控制
- **WHEN** Machines 在 tablet 或 desktop 顯示
- **THEN** 所有狀態以 segmented buttons 呈現；phone 則以適合觸控的 select 呈現，且不造成整頁水平捲動
