# Tasks: add-alert-lifecycle

## 1. Schema

- [x] 1.1 在 `backend/src/alerts/schemas/alert.schema.ts` 的 `ALERT_STATUSES` 加入 `'ACKNOWLEDGED'`,位置在 `'ACTIVE'` 跟 `'RESOLVED'` 之間
- [x] 1.2 在 `Alert` schema 加入 `acknowledgedAt: string | null`(預設 `null`),比照既有的 `resolvedAt` 屬性

## 2. Service:轉換邏輯

- [x] 2.1 `AlertsService.acknowledgeAlert(machineId, alertId)`:`assertExists(machineId)`(404 `MACHINE_NOT_FOUND`)→ 用 `{ alertId, machineId }` 找 alert(找不到就 404 `ALERT_NOT_FOUND`)→ 如果 `status === 'RESOLVED'`,拋出 `ApiError(409, 'INVALID_ALERT_TRANSITION', ...)` → 如果 `status === 'ACTIVE'`,設定 `status: 'ACKNOWLEDGED'` 跟 `acknowledgedAt` 為現在時間、儲存 → 透過既有的 `toResponse` 形狀回傳更新後(或對已經是 `ACKNOWLEDGED` 的 no-op 情況,不變)的 alert
- [x] 2.2 `AlertsService.resolveAlert(machineId, alertId)`:同樣的查找方式 → 如果 `status` 是 `ACTIVE` 或 `ACKNOWLEDGED`,設定 `status: 'RESOLVED'` 跟 `resolvedAt` 為現在時間(`acknowledgedAt` 維持原樣)、儲存 → 如果已經是 `RESOLVED`,no-op → 回傳 alert
- [x] 2.3 把 `AlertsService.listAlerts` 的 `status` 驗證擴充成接受逗號分隔的列表:用 `,` 切開,對每個值段都對照 `ALERT_STATUSES` 驗證(任何一段不合法就 400 `INVALID_QUERY_PARAMETER`),超過一個合法值時用 `$in` 建構 Mongo filter

## 3. Controller:新路由

- [x] 3.1 在 `AlertsController` 加入 `POST /machines/:id/alerts/:alertId/acknowledge`(`@HttpCode(HttpStatus.OK)`,比照 `insights` controller 們 POST 回 200 的慣例——這是一個帶有意義回應內容的狀態變更,不是像 simulator 那種 `202` 發後不理的形式)
- [x] 3.2 在 `AlertsController` 加入 `POST /machines/:id/alerts/:alertId/resolve`,同樣的樣式

## 4. 文件

- [x] 4.1 `docs/design/api.md`:為兩個新端點新增 §4.14/§4.15(請求/回應形狀、錯誤情境),依循既有 §4 的合約樣式;更新 §5.3 的 `Alert` 欄位表,加入 `acknowledgedAt`;更新 §6 的錯誤表,加入 `404 ALERT_NOT_FOUND` 跟 `409 INVALID_ALERT_TRANSITION`;把 `resolve` 那行從 §8「未來端點」移除(已經實作了)(+ zh-TW 對照版,完整包含新的 §4.14/§4.15 兩個章節)
- [x] 4.2 `docs/design/architecture.md` §12.3:把 `acknowledgedAt` 加進 `alerts` collection 的核心欄位清單(+ zh-TW 對照版)
- [x] 4.3 確認沒有其他登記過的文件需要新的錯誤碼或端點(沒有新的 Kafka topic、沒有新的模組、沒有新的環境變數——這次變更完全在既有的 `alerts/` 模組裡)

## 5. 前端

- [x] 5.1 `frontend/src/api/types.ts`:把 `'ACKNOWLEDGED'` 加進 `Alert['status']` 的聯集,加入 `acknowledgedAt: string | null`
- [x] 5.2 `frontend/src/api/alerts.ts`:加入 `acknowledgeAlert(machineId, alertId)` 跟 `resolveAlert(machineId, alertId)`;`listAlerts` 的 `status` 參數現在接受單一狀態或陣列(用 `,` 接起來)
- [x] 5.3 `frontend/src/components/ActiveAlertsCard.vue`:查詢改成 `['ACTIVE', 'ACKNOWLEDGED']`;透過 `useMutation` 加入 Acknowledge(只在 `ACTIVE` 列顯示)跟 Resolve(兩者都顯示)按鈕,成功後讓 `['alerts']` 這個 query key 失效;`ACKNOWLEDGED` 列會有一個灰色標籤,跟 `ACTIVE` 做出區分

## 6. 驗證

- [x] 6.1 在 `backend/src/alerts/alert-lifecycle.spec.ts` 新增單元測試:`ACTIVE`→acknowledge→`ACKNOWLEDGED`;`ACKNOWLEDGED`→acknowledge→no-op;`RESOLVED`→acknowledge→409;`ACTIVE`→resolve→`RESOLVED`(跳過確認的路徑,`acknowledgedAt` 維持 `null`);`ACKNOWLEDGED`→resolve→`RESOLVED`(`acknowledgedAt` 保留);`RESOLVED`→resolve→no-op;未知的 `machineId` → 404(alert 完全不會被查詢);`alertId` 屬於別的機台 → 404。全部通過。
- [x] 6.2 在 `backend/src/alerts/status-validation.spec.ts` 新增測試:`status=ACTIVE,foo` 被拒絕;`status=ACTIVE,ACKNOWLEDGED` 會用 `{ status: { $in: [...] } }` 查詢 Mongo;單值的 `status=ACTIVE` 依然用單純的值查詢(形狀不變)。全部通過。
- [x] 6.3 針對真實跑起來的 Docker stack(不只是單元測試)做現場 demo 流程驗證。API 層:透過 `POST /simulator/events` 觸發一個 `TEMPERATURE_REPORTED` 事件,確認產生的 alert;確認它(200,`status: ACKNOWLEDGED`,`acknowledgedAt` 已設定);重複確認(200,no-op,同一個 `acknowledgedAt`);結案它(200,`status: RESOLVED`,`acknowledgedAt` 保留,`resolvedAt` 已設定);嘗試確認已結案的 alert(409 `INVALID_ALERT_TRANSITION`);重複結案(200,no-op)。也確認了:未知的 `machineId` → 404 `MACHINE_NOT_FOUND`;一筆真實的 `alertId` 但用在*別台*機台的路徑上 → 404 `ALERT_NOT_FOUND`;`GET /alerts?status=ACTIVE,ACKNOWLEDGED` 回傳符合的 alert;`status=ACTIVE,foo` → 400。
  瀏覽器層:安裝了 Playwright + Chromium(不是專案相依套件,在 scratch 目錄跑),端到端操作真實跑在 `localhost:5173` 的 Dashboard——觸發一筆新 alert、載入頁面、點下那一列真正的「Acknowledge」按鈕:那一列重新渲染,多出 `ACKNOWLEDGED` 標籤,「Acknowledge」按鈕消失,「Resolve」還在。點下「Resolve」:那一列從 widget 整個消失(查詢排除了 `RESOLVED`)。整個流程瀏覽器 console 錯誤數為零。這確認了真正的「點擊 → mutation → cache 失效 → 重新渲染」這條路徑是通的,不只是程式碼能編譯而已。
- [x] 6.4 完整回歸測試:backend `npm run build` / `npm run lint`(0 個錯誤,1 個既有、無關的警告)/ `npm test`(66/66 通過,共 14 個 suite,從 55/13 增加)全部乾淨。前端 `vue-tsc -b && vite build` 乾淨(第一次嘗試在這個環境預設的 Node 18.16 下失敗——`vite`/`rolldown` 需要 Node ≥20——換成 Node 22.16 就成功了;不是這次變更造成的回歸,是既有的環境限制)。`openspec validate add-alert-lifecycle --strict` 跟 `openspec validate --all`(12/12)都通過。
