## 背景

Card 目前將 header button 直接接到 generation mutation。Disabled HTML control 不一定會送出 hover event。

## 目標／非目標

**目標：** 正確表示可用性並保留可閱讀的 summary content。

**非目標：** 移除 summary API 或 mock data。

## 決策

將 disabled button 包在可接收 hover event 的 tooltip trigger 中。移除 action 的 mutation wiring，避免意外送出 request。Tooltip 原樣使用使用者指定的正體中文訊息。

## 風險／取捨

- [Disabled action 可能不明顯] → 保留既有 primary secondary style，並用 tooltip 說明。
