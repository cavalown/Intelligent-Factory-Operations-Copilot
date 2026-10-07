## 原因

UI 目前把 AI generation 呈現為可用，但專案只有 mock provider。停用 action 可避免 demo 過度宣稱完成度，同時保留規劃中功能的可見性。

## 變更內容

- 停用 AI Summary Generate 與 Regenerate action。
- Hover 時說明功能尚未開放。
- 既有 stored／mock summary 仍可閱讀。

## 能力

### 新增能力

無。

### 修改能力

- `operator-ui`：AI summary generation 成為明確不可用的預覽 action。

## 影響

- 僅 `AiSummaryCard.vue` 與 MVP 文件；不變更 API 或 backend。
