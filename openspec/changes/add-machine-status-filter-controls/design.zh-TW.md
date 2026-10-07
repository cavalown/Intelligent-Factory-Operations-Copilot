## 背景

Machine List 已解析並套用 `route.query.status`；只缺少永遠可見的 input。

## 目標／非目標

**目標：** 讓篩選容易發現，並保留 URL-driven Dashboard drill-down。

**非目標：** Server-side filtering 或新 status semantics。

## 決策

寬度 ≥640px 使用 radio-button segments，低於 640px 使用 select。數量由既有 polling 的 machine collection 計算。`ALL` 僅為 UI value，會從 URL 移除 `status`；domain values 不變。

## 風險／取捨

- [六個按鈕需要寬度] → 低於 640px 使用緊湊 select，desktop group 必要時可換行。
