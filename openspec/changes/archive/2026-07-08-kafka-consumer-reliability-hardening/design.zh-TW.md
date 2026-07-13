## 脈絡

`KafkaConsumerBase.onModuleInit`（`backend/src/shared/kafka/kafka-consumer.base.ts`）直接接線 `eachMessage: (payload) => this.handleMessage(payload)`，沒有任何包裝。全部 3 個子類別（`EventConsumerService`、`MachineProjectionConsumerService`、`AlertConsumerService`）都呼叫 `JSON.parse(message.value.toString())` 然後不做綱要驗證就對結果採取行動，信任 `machine.events` 上的每則訊息都經過 `SimulatorService` 的 HTTP 邊界驗證。這個信任在兩方面錯置：(1) `SimulatorService` 自己的驗證有真實缺口（`STATUS_CHANGED.currentStatus` 未對照 enum 檢查；`schemaVersion` 未檢查型別）；(2) 即使 HTTP 邊界驗證完美，topic 也不保證只會收到來自那一條 HTTP 路徑的訊息（重播、未來的 producer、手動測試訊息）。

## 目標 / 非目標

**目標：**
- 沒有任何單一格式錯誤/邊界情況的 Kafka 訊息能永久卡死一個 consumer group。
- 在 HTTP 邊界堵上兩個具體驗證缺口（`currentStatus` enum、`schemaVersion` 型別），讓常見情況能早期以清楚的 `4xx` 回應抓到，而不是幾分鐘後以 consumer 崩潰的形式浮現。
- 用窄而局部的防護防止兩個無聲毀損情況（`NaN` 的 `productionCount`、告警訊息中的「undefined」）。

**非目標：**
- 不做死信佇列、不做帶退避的重試政策、不為被跳過的訊息做告警/可觀測性管線。這刻意是止血的最小修復 — 明確延後的部分見下方風險。
- 不改 `machine.events` topic 的綱要、分割區或 consumer group 設定。
- 不對每則訊息重新驗證每個欄位（那會在 consumer 內重複 `SimulatorService` 的驗證，本身就是維護負擔）— 只有缺失/格式錯誤會導致崩潰或無聲毀損的特定欄位獲得防護。

## 決策

### 1. 錯誤邊界只修一次，在 `KafkaConsumerBase`，不是各子類別

全部 3 個 consumer 共享同一個缺失錯誤邊界的問題，所以修復屬於共用基底類別，不是複製貼上進各子類別（避免在一個 code review 剛因此點名的 codebase 裡又來一次 3 倍重複）。`onModuleInit` 從：

```typescript
await this.consumer.run({
  eachMessage: (payload) => this.handleMessage(payload),
});
```

改為包裝呼叫：

```typescript
await this.consumer.run({
  eachMessage: async (payload) => {
    try {
      await this.handleMessage(payload);
    } catch (err) {
      this.logger.error(`Failed to process message: ${err}`, err instanceof Error ? err.stack : undefined);
    }
  },
});
```

這需要 `KafkaConsumerBase` 有自己的 `Logger`（各子類別已為其他訊息各自建立 `Logger` 實例；基底類別也拿到一個，經由 `this.constructor.name` 以具體子類別名稱為範圍）。

### 2. catch 的政策：記錄後跳過，不是重試到崩潰

接住錯誤且*不*重新拋出，表示 kafkajs 仍會越過該訊息前進（consumer 的 `eachMessage` 正常返回就是允許 offset 提交前進的條件）— 訊息實際上被跳過，不是被重試。這是拿「一則壞訊息永遠擋住一切」換「一則壞訊息在記錄後被丟棄」。對一個沒有死信佇列的 MVP，這是較安全的預設：卡住的 consumer group 會無聲地擋住整條管線（所有機台，不只那一個事件），而被丟棄的訊息只損失那一個事件的效果。調查差異的人可以在 `docker logs` 輸出中 grep 該錯誤。

曾考慮的替代方案：先做有限次數的重試再跳過。目前否決 — 尚無證據顯示暫時性失敗（相對於永久格式錯誤的訊息）是這個 codebase 失敗模式中的真實問題；本變更修復的 6 個發現全是決定性的（無效的訊息永遠無效，重試不會改變什麼）。若出現真實的暫時性失敗案例再重新檢視。

### 3. 即使已有 catch-all，仍在邊界堵驗證缺口

決策 1 的 catch-all 是安全網，不是輸入驗證的替代品 — 它把崩潰變成無聲跳過，嚴格來說更好，但仍表示事件遺失且送出者得不到任何回饋。`SimulatorService` 的兩個缺口（`currentStatus` enum、`schemaVersion` 型別）修起來便宜，且能給 HTTP 呼叫者立即、可行動的 `4xx`，而不是 `202` 之後下游無聲的資料遺失。依 `docs/design/api.md` §6（第 387 行），型別錯誤的信封欄位已落在記載的 `400 INVALID_EVENT_ENVELOPE` 之下 — `schemaVersion` 的型別檢查屬於 `validateEnvelope`，不是新錯誤代碼。`currentStatus` 的 enum 檢查是 payload 考量，已記載在 `422 PAYLOAD_VALIDATION_FAILED` 之下。

### 4. `NaN`/`undefined` 防護留在各自的呼叫點，不併入 catch-all

決策 1 的 try/catch 只在有東西*拋出*時有幫助。`productionCount += undefined`（→ `NaN`）與 `undefined <= threshold`（→ `false`，跳過原本要提前返回的路徑）不會拋出 — 它們是無聲的邏輯 bug，不是例外。這些需要在確切的使用點各自的窄 `typeof`/`Number.isFinite` 防護，依 code review 的發現 #4 與 #6。這不做共用抽象 — 兩個孤立的單行防護，不值得泛化。

## 風險 / 取捨

- **[風險] 無聲跳過格式錯誤的訊息，表示資料遺失且除了一行日誌外沒有操作員可見的訊號。** → **緩解**：MVP 階段接受（見決策 2）；正式的死信 topic 或解析失敗告警是 Phase 2/3 的基礎設施工作，不在此範圍。明確標記，以免被誤認為「已解決」。
- **[風險] `KafkaConsumerBase` 的 catch-all 可能在開發期間掩蓋真實 bug**（例如新事件類型分支中的錯字現在會記錄後繼續，而不是在開發環境大聲崩潰）。→ **緩解**：日誌行包含完整錯誤與堆疊追蹤；`docker logs ifoc-backend` 在手動驗證期間仍是真實來源，與今天相同。
- **[風險] 在 simulator 邊界堵 `currentStatus` enum 缺口，對經其他途徑抵達 Kafka 的訊息沒有幫助**（重播、手動發布）。→ **緩解**：這正是決策 1 的 catch-all 作為縱深防禦存在的原因 — 邊界修復與 catch-all 是互補的，不是冗餘。

## 遷移計畫

無資料遷移。純加法/防禦性：既有有效輸入的行為不變；只有先前會崩潰/毀損的路徑改變行為（改為記錄後跳過，或以 4xx 拒絕）。以正常的後端重建部署（`docker compose up -d --build backend`）。
