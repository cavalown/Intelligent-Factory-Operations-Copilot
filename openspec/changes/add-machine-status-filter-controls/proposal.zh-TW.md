## 原因

目前只有從 Dashboard drill down 後才容易發現機台狀態篩選。直接開啟 Machines 的操作員需要可見的控制來切換營運狀態。

## 變更內容

- 在 Machines 新增帶即時數量的狀態篩選控制。
- Tablet／desktop 使用 segmented controls，phone 使用 select。
- Filter state 沿用既有 `?status=` URL contract。

## 能力

### 新增能力

無。

### 修改能力

- `operator-ui`：Machine List 新增可直接操作的狀態篩選控制。

## 影響

- 僅 Machine List frontend；不變更 backend 或 API。
