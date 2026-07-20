## 新增 Requirements

### Requirement: 確認一筆 ACTIVE 或 ACKNOWLEDGED 的 alert

系統必須提供 `POST /machines/:id/alerts/:alertId/acknowledge`。當 alert 目前的 `status` 是 `ACTIVE` 時,系統必須把 `status` 設為 `ACKNOWLEDGED`,並把 `acknowledgedAt` 設為目前時間。當 alert 目前的 `status`已經是 `ACKNOWLEDGED` 時,系統必須讓 alert 維持不變、原樣回傳(冪等 no-op)。兩種情況都必須回應 `200`,附上完整更新後的 alert。

#### Scenario: 確認一筆 ACTIVE 的 alert
- **當** client 對一筆 `status: ACTIVE` 的 alert POST `/machines/M-001/alerts/:alertId/acknowledge`
- **則** 系統回應 `200`,alert 現在顯示 `status: ACKNOWLEDGED`,而且 `acknowledgedAt` 不是 null

#### Scenario: 重複確認一筆已經是 ACKNOWLEDGED 的 alert 是 no-op
- **當** client 對一筆 `status: ACKNOWLEDGED` 的 alert POST `.../acknowledge`
- **則** 系統回應 `200`,alert 維持不變,包含原本的 `acknowledgedAt`

### Requirement: 結案一筆 ACTIVE、ACKNOWLEDGED,或 RESOLVED 的 alert

系統必須提供 `POST /machines/:id/alerts/:alertId/resolve`。當 alert 目前的 `status` 是 `ACTIVE` 或 `ACKNOWLEDGED` 時,系統必須把 `status` 設為 `RESOLVED`,並把 `resolvedAt` 設為目前時間,`acknowledgedAt` 維持不變(如果這筆 alert 從沒被確認過就是 `null`)。當 alert 目前的 `status` 已經是 `RESOLVED` 時,系統必須讓 alert 維持不變、原樣回傳(冪等 no-op)。所有情況都必須回應 `200`,附上完整更新後的 alert。

#### Scenario: 直接結案一筆 ACTIVE 的 alert(跳過確認)
- **當** client 對一筆 `status: ACTIVE` 的 alert POST `/machines/M-001/alerts/:alertId/resolve`
- **則** 系統回應 `200`,alert 現在顯示 `status: RESOLVED`、`resolvedAt` 不是 null,且 `acknowledgedAt: null`

#### Scenario: 結案一筆 ACKNOWLEDGED 的 alert
- **當** client 對一筆 `status: ACKNOWLEDGED`、`acknowledgedAt` 不是 null 的 alert POST `.../resolve`
- **則** 系統回應 `200`,`status: RESOLVED`、`resolvedAt` 不是 null,且原本的 `acknowledgedAt` 維持不變

#### Scenario: 重複結案一筆已經是 RESOLVED 的 alert 是 no-op
- **當** client 對一筆 `status: RESOLVED` 的 alert POST `.../resolve`
- **則** 系統回應 `200`,alert 維持不變,包含原本的 `resolvedAt`

### Requirement: 已結案的 alert 不能被確認

系統必須拒絕對一筆目前 `status` 是 `RESOLVED` 的 alert 發出的 `acknowledge` 請求,回應 `409`、錯誤碼 `INVALID_ALERT_TRANSITION`,而且不得修改這筆 alert。

#### Scenario: 確認一筆已結案的 alert 會被拒絕
- **當** client 對一筆 `status: RESOLVED` 的 alert POST `.../acknowledge`
- **則** 系統回應 `409`、錯誤碼 `INVALID_ALERT_TRANSITION`,alert 的 `status` 維持 `RESOLVED`

### Requirement: 兩個動作都會一起驗證機台跟 alert 是否存在

如果 `:id` 路徑參數不符合任何既有機台,系統必須回應 `404`、錯誤碼 `MACHINE_NOT_FOUND`。在機台合法的前提下,如果 `:alertId` 不符合任何屬於該機台的 alert(包含 `:alertId` 合法但屬於*另一台*機台的情況),系統必須回應 `404`、錯誤碼 `ALERT_NOT_FOUND`。

#### Scenario: 未知的機台
- **當** client 對一個不存在的 `machineId` POST `/machines/M-999/alerts/:alertId/acknowledge`(或 `/resolve`)
- **則** 系統回應 `404`、錯誤碼 `MACHINE_NOT_FOUND`

#### Scenario: Alert ID 屬於另一台機台
- **當** client POST `/machines/M-002/alerts/:alertId/acknowledge`,而 `:alertId` 存在但屬於 `M-001`
- **則** 系統回應 `404`、錯誤碼 `ALERT_NOT_FOUND`

### Requirement: 已確認跟未解決的 alert 可以一起查詢

系統必須接受 `GET /alerts` 跟 `GET /machines/:id/alerts` 的 `status` 查詢參數帶逗號分隔的多個值(例如 `status=ACTIVE,ACKNOWLEDGED`),回傳 `status` 符合任一列出值的 alert,最新在前。單一值(例如 `status=ACTIVE`)必須繼續維持這次變更之前完全一樣的行為。

#### Scenario: 多值 status 篩選回傳任一列出狀態的 alert
- **當** client GET `/alerts?status=ACTIVE,ACKNOWLEDGED`
- **則** 系統回傳 `status` 是 `ACTIVE` 或 `ACKNOWLEDGED` 的 alert,最新在前,排除 `RESOLVED` 的 alert

#### Scenario: 單值 status 篩選不變
- **當** client GET `/alerts?status=ACTIVE`
- **則** 系統只回傳 `ACTIVE` 的 alert,跟這次變更之前完全一樣
