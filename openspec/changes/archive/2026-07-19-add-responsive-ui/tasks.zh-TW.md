# 任務：add-responsive-ui

## 1. 基礎

- [x] 1.1 `useViewport` composable 包裝 Naive UI 的斷點 hook（`isPhone`/`isTablet`/`isDesktop`，640/1024）— 斷點的單一真實來源（設計 D1）
- [x] 1.2 全域版面 CSS：`.dashboard-row`/`.detail-row` 的堆疊 media query（<1024px 時子項全寬）、分頁列時代的內容底部 padding class

## 2. 導覽

- [x] 2.1 `BottomTabBar` 元件（4 個目的地、圖示 + 標籤、作用中突顯、固定 56px）在手機寬度渲染；頂部 `NMenu` 條件式地不存在（設計 D2）
- [x] 2.2 驗證五個頁面的內容在分頁列上方都有足夠間隙（沒有被遮住的按鈕/頁尾）

## 3. 頁面調整

- [x] 3.1 機台列表手機卡片模式：表格與卡片共用同一個列塑形 helper；卡片 = 狀態標籤 + 名稱 + 指標列，整卡點擊 → 詳情；`?status=` 篩選 + 可清除指示在兩種渲染都有效（設計 D3）
- [x] 3.2 `EventsTable` 精簡模式：手機上移除 payload 欄，包在 `overflow-x: auto` 容器內；Event Center / Dashboard 小工具 / 機台詳情自動繼承（設計 D4）
- [x] 3.3 機台詳情：`NDescriptions` 響應式欄數（1/2/3）；稼働率條乾淨換行
- [x] 3.4 Dashboard：重新檢查 390px 下的磚格 span；只有在驗證顯示破版時才調整
- [x] 3.5 觸控走查：手機/平板路徑的點擊目標尺寸（卡片點擊、load-more、產生/重新產生、simulator 表單控制項）；不使用只靠 hover 的操作提示

## 4. 驗證

- [x] 4.1 Playwright 三視口執行（390 / 768 / 1280）：五個頁面都渲染哨兵元素、無 body 水平捲動、每頁每視口截圖
- [x] 4.2 手機流程細項：透過分頁列走遍四個分頁、點機台卡片進詳情、從 Warning 磚下鑽到篩選後的卡片清單
- [x] 4.3 桌面不退步：1280px 截圖與現行版面目視比對；頂部選單 + 並排列 + 完整表格完好 — 所有驗證於 2026-07-13 透過 headless Chrome 在 390/768/1280 完成：15 個頁面渲染零 body 水平溢出、分頁列四向導覽、卡片點擊 → 詳情、Warning 磚 → 篩選後卡片清單、payload 欄手機不見/桌面存在、無頁面錯誤

## 5. Code-review 修復（2026-07-13 審查，10 個發現全數處理）

- [x] 5.1 安全區間隙：`.app-content--phone` → `calc(76px + env(safe-area-inset-bottom))`（瀏海手機上內容被分頁列遮住）
- [x] 5.2 手機卡片分支加上 NSkeleton 載入狀態與 NEmpty 零符合狀態（與 NDataTable 內建行為對等）；以 `?status=IDLE` 驗證
- [x] 5.3 文件/程式碼漂移解決：設計 D1 與 frontend-responsive.md 的 Mechanics 現在記載 matchMedia 實作 + vooks 理由
- [x] 5.4 `navigation.ts` 單一導覽設定（key/label/tabLabel/icon）由兩個導覽共用；標籤差異現在明確集中在一處
- [x] 5.5 路由→導覽 key 對應移到 router `meta.navKey` + 共用的 `activeNavKey()`（原本在 App.vue 與 BottomTabBar 重複）
- [x] 5.6 formatTimestamp 遷移完成（MachineDetailPage 的 Last Updated、AiSummaryCard 的 createdAt）
- [x] 5.7 useViewport 重寫：只用 min-width 的互補區間（無小數縫隙）、惰性初始化（import 永不碰 window）、HMR dispose
- [x] 5.8 Media query 改為與 composable 區間相符的範圍語法，每處都註記標準值指標
- [x] 5.9 平板磚密度（3/列）確認為刻意決定（使用者 2026-07-13 決定）並記載於格線註解
- [x] 5.10 回歸：build 乾淨、三視口執行全綠、空狀態與共用導覽流程在 headless Chrome 驗證
