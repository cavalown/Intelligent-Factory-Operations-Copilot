## 為什麼

Alert 目前只能建立,不能操作:`Alert.status` 只有 `ACTIVE`/`RESOLVED` 兩個值,系統裡沒有任何地方會去轉換它,也完全沒有任何端點可以修改一筆 alert——只有 `GET` 讀取存在。操作員沒有辦法表達「我已經看到了」或「這個修好了」,所以每一筆操作員已經處理過的 alert,看起來都跟沒人看過的一模一樣。這不是新開的範圍,而是早就被預期到的:`docs/design/api.md` §8 在「Phase 2 — incident management」底下列了 `POST /machines/:id/alerts/:alertId/resolve`,前端的 `ActiveAlertsCard.vue` 也帶著「ACK lifecycle is Phase 2 — read-only until then」的註解。`docs/product/product-roadmap.md` 的 Phase 2 直接點名了這個功能:「Alert Acknowledgment & Resolution Workflow」。

## 有哪些變更

- `Alert.status` 多了第三個值 `ACKNOWLEDGED`,介於 `ACTIVE` 跟 `RESOLVED` 之間。**BREAKING**:任何對照目前兩值集合(`ACTIVE`、`RESOLVED`)做驗證的程式碼或 client,都要考慮到這個新值。
- `Alert` 新增 `acknowledgedAt: string | null` 欄位,比照既有的 `resolvedAt`。
- 兩個新端點:確認一筆 alert(`ACTIVE` → `ACKNOWLEDGED`)跟結案一筆 alert(`ACTIVE`/`ACKNOWLEDGED` → `RESOLVED`)。確切路由跟允許的轉換表由 design.md 決定。
- 前端:`ActiveAlertsCard.vue`(以及任何其他 alert 列表介面)拿到確認/結案的操作,取代現在唯讀的呈現方式。
- 不引入使用者/操作者身分——這個專案完全沒有帳號系統,所以沒有「誰確認的」/「誰結案的」欄位。這個工作流程追蹤的是*什麼時候*,不是*誰*。

## Capabilities

### 新增 Capabilities
- `alert-lifecycle`:狀態轉換動作(確認、結案)及其 API 介面——擁有「alert 建立之後狀態怎麼變化」這個關注點,跟 `alert-detection`「一開始什麼時候建立 alert」是分開的。

### 修改 Capabilities
- `alert-detection`:它既有的「status 篩選要對照 alert-status 值域做驗證」這條 requirement,值域從兩個值(`ACTIVE`、`RESOLVED`)變成三個(`ACTIVE`、`ACKNOWLEDGED`、`RESOLVED`)。

## 影響

- **程式碼**:`backend/src/alerts/schemas/alert.schema.ts`(新狀態值、新欄位)、`alerts.service.ts`(新的轉換方法)、controller 加新路由、`frontend/src/api/alerts.ts` + `frontend/src/api/types.ts`(新的 client 呼叫、更新 `Alert` 型別)、`frontend/src/components/ActiveAlertsCard.vue`(可操作的 UI)。
- **API**:兩個新端點,形狀是 `docs/design/api.md` §8 早就預告好的;依照它自己 §7/§8 的慣例(「每個未來端點在實作前應該先在這份文件裡規格化」),`docs/design/api.md` 需要在實作前先更新。
- **文件**:`docs/design/architecture.md` §12.3(`alerts` collection 欄位)、`openspec/specs/alert-detection/spec.md`(status 值域的 requirement)。
- **既有 GET 端點的回應形狀沒有破壞性變更**——`acknowledgedAt` 是新增欄位;`ACKNOWLEDGED` 是新增的列舉值,既有的 `ACTIVE`/`RESOLVED` 篩選不受影響。
