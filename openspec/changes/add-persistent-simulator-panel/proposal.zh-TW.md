## 原因

目前 Simulator 是獨立目的地，展示者必須離開想觀察反應的畫面。把事件控制放在作用中畫面旁，可直接看見因果循環，明顯改善現場 demo。

## 變更內容

- 將 Simulator 控制移入全域 application shell。
- Desktop 顯示固定右側欄，tablet 與 phone 使用隨選 drawer。
- 移除 Simulator 的獨立導覽目的地，同時保留相同表單狀態、驗證及成功／錯誤回饋。

## 能力

### 新增能力

無。

### 修改能力

- `operator-ui`：Simulator 控制在每個主要 view 旁皆可使用，並具響應式 rail／drawer 行為。

## 影響

- Frontend application shell、導覽、routing 與 Simulator component 結構。
- 不變更 backend 或 API contract，也不新增 dependency。
