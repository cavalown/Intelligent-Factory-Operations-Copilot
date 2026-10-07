## 背景

`SimulatorPage.vue` 目前擁有可重用表單，但只在 `/simulator` 掛載。`App.vue` 已負責 viewport-aware navigation，也最適合承載跨 route 保持的控制。

## 目標／非目標

**目標：** 保持被觀察頁面可見、跨導覽保留表單狀態，並遵循既有 640／1024 響應式區間。

**非目標：** 變更 event payload、新增自動 simulation 或修改 polling。

## 決策

1. 將表單抽成 `SimulatorPanel.vue` 並在 `App.vue` 掛載單一 instance，因此 route 變更不會銷毀狀態。
2. Desktop 使用 340px sticky 右側欄搭配流動主內容；tablet／phone 使用由醒目 header button 開啟的右側 Naive UI drawer。
3. 從 navigation 移除 Simulator，並將舊 `/simulator` URL redirect 到 Dashboard，避免同一控制有兩種互相競爭的呈現並保留 bookmark 相容性。
4. Drawer 保持 mounted，因此關閉不會重設輸入。

## 風險／取捨

- [Desktop 內容變窄] → 提高 shell 最大寬度，right rail 固定為 340px。
- [Drawer 會暫時遮住頁面] → 它可關閉；在窄寬度持續並排會讓兩個 surface 都無法使用。
- [既有 Simulator bookmark] → Redirect 到可立即使用控制的 Dashboard。
