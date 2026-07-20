## 背景

`Alert.status`(`backend/src/alerts/schemas/alert.schema.ts`)目前是 `ACTIVE` | `RESOLVED`,但程式碼庫裡從來沒有任何地方寫過 `RESOLVED` 或設定 `resolvedAt`——兩者都是被延後功能留在 schema 裡沒用到的殘留。`docs/design/api.md` §8 已經預告了一個端點(`POST /machines/:id/alerts/:alertId/resolve`,「Phase 2 — incident management」),但沒有確認(acknowledge)這一步;`docs/product/product-roadmap.md` 的 Phase 2 項目名稱直接叫「Alert Acknowledgment & Resolution Workflow」,暗示兩個動作都要有。目前前端唯一會顯示 alert 的地方是 Dashboard 上的 `ActiveAlertsCard.vue`——沒有專屬的 alerts 頁面,`MachineDetailPage.vue` 也完全不顯示 alert。

這個專案完全沒有任何身分驗證或使用者身分系統(用 grep 掃過 `docs/`、`ai/`,以及 backend 都確認過)——這個 repo 之前的每一個設計決策都把操作員當成單一、不分你我的角色。這次變更延續這個定位:它追蹤的是 alert *什麼時候*被確認/結案,不是*誰*做的。

## 目標 / 非目標

**目標:**

- 操作員可以把一筆 `ACTIVE` 的 alert 標記為已看到(`ACKNOWLEDGED`),之後再標記為已修好(`RESOLVED`),操作入口在 Dashboard 的 Active Alerts widget。
- Active Alerts widget 繼續顯示還需要處理的 alert(`ACTIVE` 跟 `ACKNOWLEDGED`),但不再顯示已經 `RESOLVED` 的——符合它自己既有的用途註解:「the actionable 'what needs attention now' view」。
- 每一次狀態轉換都在伺服器端對照一張明確的允許轉換表做驗證;不合法的轉換會被拒絕,而不是被默默接受或默默變成 no-op(那樣會把操作員的誤操作藏起來)。

**非目標:**

- 不加「誰確認的」/「誰結案的」操作者欄位——沒有身分系統可以拿來歸屬。
- 不支援把已經 `RESOLVED` 的 alert 重新打開回 `ACTIVE`/`ACKNOWLEDGED`。如果一個已解決的問題又發生,系統在事件層本來就處理得很好:一個新的觸發事件(依照 `alert-detection` 既有的規則)會建立一筆帶著新 `eventId` 的新 alert。重開舊的那筆反而會讓兩筆 alert 可能代表同一次復發,更糟不是更好。
- 不做批次確認/結案(「全部確認」)。在這個專案 3 台機台的 demo 規模下,一筆一筆操作不算負擔;批次端點是投機性的範圍擴張。
- 不做通知、升級,或事故分組行為——這些是 Phase 2 路線圖上另外、比較後面的項目(Notification Center、Incident Management、Alert Escalation Rules),未來可能會建立在這次變更的狀態機之上,但不屬於這次變更的範圍。

## 決策

### D1:三態生命週期 `ACTIVE → ACKNOWLEDGED → RESOLVED`,允許跳過確認

允許的轉換:

| 從 | acknowledge | resolve |
| --- | --- | --- |
| `ACTIVE` | → `ACKNOWLEDGED` | → `RESOLVED` |
| `ACKNOWLEDGED` | → `ACKNOWLEDGED`(冪等 no-op) | → `RESOLVED` |
| `RESOLVED` | **拒絕**(409) | → `RESOLVED`(冪等 no-op) |

`ACTIVE` 被允許直接結案,跳過 `ACKNOWLEDGED`——如果操作員已經知道怎麼修了,硬要求先點兩次只是增加摩擦,沒有安全上的好處。呼叫一個會讓 alert 停在*目前狀態*的動作(對已經是 `ACKNOWLEDGED` 的重複確認、對已經是 `RESOLVED` 的重複結案)會成功變成 no-op,而不是報錯——重複點擊,或是兩個操作員分頁之間的競態,不應該讓一個已經發生過的動作跳出錯誤。但對一筆 `RESOLVED` 的 alert 呼叫 `acknowledge` 會被拒絕:這不是「no-op 同狀態」,而是要求往回走,這在非目標裡已經被排除了。

**考慮過的替代方案**:強制要求 `ACTIVE → ACKNOWLEDGED → RESOLVED`(不允許跳過)。已拒絕——這個專案沒有任何證據顯示操作員需要被強制走兩步流程,而且路線圖上的功能名稱是「Acknowledgment *&* Resolution」,不是「Acknowledgment *then* Resolution」。

### D2:兩個新端點,巢狀在 `/machines/:id/alerts/:alertId/` 底下,符合 api.md §8 已經寫好的形狀

```
POST /machines/:id/alerts/:alertId/acknowledge
POST /machines/:id/alerts/:alertId/resolve
```

`resolve` 的路由已經被 `docs/design/api.md` §8 一字不差地預告過;`acknowledge` 依照完全相同的形狀加進去。兩者都不需要 request body(動作本身就是全部的輸入),並且回傳完整更新後的 alert 物件——跟 `GET /alerts` 已經回傳的項目形狀一樣,現在多了 `acknowledgedAt`,讓前端可以直接用這個回應更新自己的 cache,不用再多打一次。

兩者的查找順序:先 `MachinesService.assertExists(machineId)`(404 `MACHINE_NOT_FOUND`,重用 `AlertsService.listAlertsForMachine` 已經在用的防護)——接著用 `{ alertId, machineId }` 一起去找 alert,不是只用 `alertId`,這樣一個合法的 `alertId` 但用在*錯的* `machineId` 路徑上,會回 404,而不是悄悄改到別台機台的 alert(404 `ALERT_NOT_FOUND`,新代碼,跟既有的 `SUMMARY_NOT_FOUND`/`MACHINE_NOT_FOUND` 是同一種形狀)——然後依照 D1 的表驗證轉換是否合法(409 `INVALID_ALERT_TRANSITION`,新代碼——用 `409 Conflict` 是因為請求本身格式正確,但跟資源目前的狀態衝突,跟 `400`「請求本身格式錯誤」是不同的情況)。

**考慮過的替代方案**:扁平的 `POST /alerts/:alertId/acknowledge`(路徑裡不帶 `machineId`),因為 `alertId` 本來就是全域唯一的(schema 上有 `unique: true`)。已拒絕,理由只有一個:要跟 api.md §8 在這次變更存在之前就已經定案的路由(`.../machines/:id/alerts/:alertId/resolve`)保持一致——讓 `acknowledge` 用一個形狀不一樣的手足路由,會比路徑裡多帶一個 `machineId` 這種小小的冗餘還要糟。

### D3:Active Alerts widget 查詢 `status=ACTIVE,ACKNOWLEDGED`——status 篩選接受逗號分隔的列表

`GET /alerts` 跟 `GET /machines/:id/alerts` 既有的 `status` 查詢參數只接受單一值,對照 `ALERT_STATUSES` 驗證。這次變更把它擴充成可以接受逗號分隔的列表(例如 `status=ACTIVE,ACKNOWLEDGED`),對每一個逗號分隔的值都做同樣的值域驗證——單獨的 `status=ACTIVE` 依然完全照原本的方式運作(當成一個元素的列表),所以這是新增,不是破壞性變更。Active Alerts widget 把查詢從 `status: 'ACTIVE'` 改成 `status: 'ACTIVE,ACKNOWLEDGED'`,在 `ACTIVE` 單獨一個值已經不再代表「還需要處理」的情況下,繼續維持它原本宣稱的用途。

**考慮過的替代方案**:維持單值的 `status` 篩選,讓 widget 各發一次請求(每個狀態一次),在前端合併。已拒絕——這會讓一個天生就是「哪些狀態算 active」單一概念的篩選,變成兩倍的請求數,而且逗號分隔的多值篩選是常見、不會讓人意外的 REST 慣例。

### D4:`acknowledgedAt` 是新欄位,`resolvedAt` 形狀不變

`acknowledgedAt: string | null`,樣式跟既有的 `resolvedAt: string | null` 一樣——設定之前是 `null`,轉換發生時變成 ISO-8601 時間戳記。結案一筆從沒被確認過的 alert(D1 的直接 `ACTIVE → RESOLVED` 路徑)會讓 `acknowledgedAt` 保持 `null`,只設定 `resolvedAt`——這兩個欄位各自獨立記錄自己的轉換,不是「有 resolvedAt 就一定要有 acknowledgedAt」這種嚴格的配對關係。

## 風險 / 取捨

- 〔把 `status` 擴充成接受逗號分隔列表是一個小小的 API 合約變更〕→ 純粹是新增(既有的單值呼叫方不受影響),而且驗證方式跟單值時完全一樣——每個逗號分隔的值都對照 `ALERT_STATUSES` 檢查,所以一個不合法的值段依然會 400,回 `INVALID_QUERY_PARAMETER`。
- 〔沒有操作者身分,代表兩個操作員可能都對同一筆 alert 做動作,卻沒有任何紀錄是誰做的〕→ 接受這個取捨;這跟這個系統其他每一塊既有的無身分驗證定位一致(例如 Simulator 頁面、AI 摘要重新產生),不是這個功能特有的問題。只有在路線圖真的引入使用者帳號時才需要重新檢視。
- 〔`409 INVALID_ALERT_TRANSITION` 是新代碼,依照 `ai/rules/error-handling.md`,代碼必須先寫進 `api.md` §6 才能使用〕→ `tasks.md` 把更新 §6 列成明確的任務,依循 `add-insights-module` 上線時新增 `SUMMARY_NOT_FOUND` 的同一個先例。

## 遷移計畫

1. 把 `ACKNOWLEDGED` 加進 `ALERT_STATUSES`,把 `acknowledgedAt` 加進 `Alert` schema(新增性質;既有文件不需要遷移——`acknowledgedAt` 預設 `null`,既有的 `ACTIVE`/`RESOLVED` 值依然合法)。
2. 把兩個轉換方法加進 `AlertsService`,接上兩個新路由。
3. 讓兩個 alert 列表端點的 `status` 查詢參數接受逗號分隔列表。
4. 更新 `docs/design/api.md`(§4、§6、§8)、`docs/design/architecture.md` §12.3,以及 `openspec/specs/alert-detection/spec.md` 的 status 值域 requirement。
5. 更新 `ActiveAlertsCard.vue`:多狀態查詢、確認/結案按鈕、`ACTIVE` 跟 `ACKNOWLEDGED` 列的視覺區分。

回滾:還原 schema/service/controller/前端的變更;不需要還原任何資料遷移,因為 `ACKNOWLEDGED`/`acknowledgedAt` 純粹是新增性質,沒有其他程式碼路徑依賴它們存在。

## 未解決的問題

沒有阻塞性的。
