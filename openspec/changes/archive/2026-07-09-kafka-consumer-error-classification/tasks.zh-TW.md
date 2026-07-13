## 1. 撤銷選項 C

- [x] 1.1 刪除 `backend/src/shared/kafka/retry.util.ts` 與 `backend/src/shared/kafka/retry.util.spec.ts`
- [x] 1.2 在 `backend/src/shared/kafka/kafka-consumer.base.ts`，移除 `withRetry` import 與 `withRetry(() => this.handleMessage(payload))` 呼叫，還原為 try 區塊內直接的 `await this.handleMessage(payload)`（分類邏輯在下一節加入）

## 2. 實作選項 B（錯誤分類）

- [x] 2.1 建立 `backend/src/shared/kafka/error-classification.util.ts`，匯出 `isDataError(err: unknown): boolean`，對 `SyntaxError`、Mongoose `ValidationError` 與 Mongoose `CastError` 回傳 `true`
- [x] 2.2 在 `backend/src/shared/kafka/kafka-consumer.base.ts` 的 `eachMessage` catch 區塊：若 `isDataError(err)`，記錄並吞掉（return，與今天的行為相同）；否則重新拋出錯誤，讓它傳播出 `eachMessage`、抵達 kafkajs 自己的 runner 層重試機制
- [x] 2.3 把引用（現已撤銷的）帶退避重試設計決策的程式碼註解更新為指向選項 B

## 3. 手動驗證（真實運行系統，不只是 build）

- [x] 3.1 重建並重啟 `backend` 容器（`docker compose up -d --build backend`）
- [x] 3.2 確認 happy path 不受影響：經 `/simulator/events` POST 一個有效事件，驗證正常處理且無新增延遲（`currentTemperature`/`lastEventId` 正確更新）
- [x] 3.3 直接對 `machine.events` 發布一則格式錯誤（非 JSON）的訊息；確認全部 3 個 consumer 在發布同一秒內記錄「Skipping unprocessable message」（無重試延遲）、容器保持運行、隨後的有效事件仍正常處理
- [x] 3.4 直接對 Kafka 發布一個 `currentStatus: "BOGUS_STATUS"` 的 `STATUS_CHANGED` 事件（繞過 simulator 的 HTTP 邊界 enum 驗證）；確認 Machine Service 的 Mongoose `ValidationError` 被分類為資料錯誤、記錄為「Skipping unprocessable message」而不是崩潰或重試，且機台的 `status` 欄位未被毀損（維持在最後的有效值）
- [x] 3.5 經 `docker logs ifoc-backend` 確認：兩種情況分類正確、無崩潰/重啟、無 rebalance、容器全程維持 `Up`
- [x] 3.6 重跑 `npm test` — 9/9 通過（`sensor-failure-contract.spec.ts` 8 個測試 + `app.controller.spec.ts` 1 個測試）；`retry.util.spec.ts` 已不存在

## 4. OpenSpec 收尾

- [x] 4.1 執行 `openspec validate kafka-consumer-error-classification --strict` 並確認通過
- [x] 4.2 上述所有任務完成並驗證後歸檔此變更
