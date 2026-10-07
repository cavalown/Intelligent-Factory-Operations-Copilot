## 修改需求

### 需求：Simulator 控制可從每個主要 view 發布格式完整的事件
Application shell SHALL 讓操作員選擇機台與五種 MVP event type 之一、填寫 payload，並 POST 完整 envelope 到 `/simulator/events`，呈現接受／拒絕結果，且不離開作用中的 Dashboard、Machines、Machine Detail 或 Event Center。控制在 desktop SHALL 為固定右側欄，在 tablet 與 phone SHALL 為隨選 drawer。

#### 情境：觀察 Dashboard 時送出事件
- **WHEN** 操作員在 Dashboard 旁開啟 Simulator 控制、選擇機台、輸入有效事件並送出
- **THEN** 應用程式 POST 完整 envelope、保持 Dashboard 可見，並顯示 `202 PUBLISHED` 確認

#### 情境：呈現驗證錯誤
- **WHEN** backend 拒絕事件（`400`/`404`/`422`）
- **THEN** 控制顯示錯誤代碼與訊息，不遺失表單狀態也不導航離開

#### 情境：窄視口使用 drawer
- **WHEN** 應用程式在低於 1024px 的寬度檢視
- **THEN** Simulator 控制可透過適合觸控的 action 開啟可關閉 drawer，且不造成整頁水平捲動

### 需求：手機透過底部分頁列導覽
在 phone 寬度，app SHALL 呈現含三個主要目的地（Dashboard、Machines、Event Center）的固定底部分頁列取代 top menu；Simulator SHALL 從全域 shell action 使用，而不占用 navigation destination，且內容 SHALL NOT 被 tab bar 遮住。

#### 情境：Tab bar 取代 top menu
- **WHEN** app 在 phone 寬度檢視
- **THEN** bottom tab bar 顯示三個主要目的地、全域 Simulator action 可使用，且開啟 drawer 不會導航離開
