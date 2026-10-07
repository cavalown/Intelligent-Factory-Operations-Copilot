## 修改需求

### 需求：AI summary 是尚未開放的 advisory preview
Summary card SHALL 繼續顯示既有 stored summary 與 `recommendedActions`，但在尚未整合真實 LLM provider 時，Generate 與 Regenerate action SHALL 為 disabled。Hover disabled-action wrapper 時 SHALL 說明功能尚未開放。AI summary 不可用 MUST NOT 影響 machine、event、alert 或 stats content。

#### 情境：既有 summary 仍可閱讀
- **WHEN** stored 或 mock summary 存在
- **THEN** summary 與 recommended actions 保持可見，Regenerate 為 disabled

#### 情境：說明不可用 action
- **WHEN** 操作者 hover Generate／Regenerate action wrapper
- **THEN** tooltip 顯示 `此功能尚未開放`

#### 情境：不存在 summary
- **WHEN** 不存在 summary
- **THEN** card 顯示 empty state 與 disabled Generate action，且不發出 generation request
