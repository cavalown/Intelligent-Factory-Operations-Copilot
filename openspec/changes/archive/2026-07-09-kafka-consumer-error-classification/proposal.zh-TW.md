## 為什麼

`kafka-consumer-reliability-hardening` 在 `KafkaConsumerBase` 的 `handleMessage` 呼叫周圍加了 catch-all，防止單一格式錯誤的「poison pill」訊息永遠卡死 consumer group。後續的 `/code-review` 發現這個 catch-all 比預期更寬：它一視同仁地吞掉**每一個**錯誤，不只是資料格式錯誤。這包括暫時性基礎設施失敗（例如 `.save()` 進行中 MongoDB 連線中斷），而 3 個子類別自己的 `catch (err) { if (isDuplicateKeyError(err)) return; throw err; }` 模式原本就是寫來讓這類錯誤傳播並讓程序崩潰的 — 在舊的（強化前）行為下，崩潰意味著容器重啟、consumer 重連後 Kafka 重送訊息。現在，同樣的暫時性失敗被記錄一次後訊息就永遠消失，沒有重試。

本提案的存在是為了讓這個選擇明確、被刻意決定，而不是預設留著目前這個比預期更寬的行為。`design.md` 列出三個候選方案（照現狀接受、分類錯誤、有限次重試）及其取捨。**使用者最初選了選項 C（帶退避的有限次重試），實作完成並手動驗證可運作 — 但針對該實作的第二次 `/code-review` 發現它引入的問題比解決的更糟**（見 `design.md` 的「為什麼選項 C 被撤銷」）：它無聲地重複了 kafkajs 自己內建的帶抖動重試機制（還少了抖動），而且在沒有 `heartbeat()` 呼叫的情況下重試一個慢慢失敗的操作，有超過 consumer session timeout、觸發 group rebalance 的風險 — 恰好發生在它想幫忙的持續停機情境。**決策修訂為選項 B（錯誤分類）**，重用 kafkajs 自己已被測試過的重試機制而不是重新發明。

## 改什麼

- 刪除 `backend/src/shared/kafka/retry.util.ts` 與 `retry.util.spec.ts`（選項 C 的實作）。
- 新的 `backend/src/shared/kafka/error-classification.util.ts` 匯出 `isDataError(err: unknown): boolean`，把 `SyntaxError`（JSON 解析失敗）、Mongoose `ValidationError` 與 Mongoose `CastError` 分類為「這則訊息的內容有錯，重試無濟於事」。
- `KafkaConsumerBase` 的 `eachMessage` catch 區塊從「記錄並吞掉一切」改為：只吞掉（記錄後跳過）`isDataError` 的錯誤；其他一切重新拋出，讓它抵達 kafkajs 自己的 runner 層重試器（帶抖動、已是 `kafkajs` 依賴中被測試過的部分），而不是手工重試迴圈。
- 不需要各子類別的變更 — 分類在基底類別以通用方式進行，所以全部 3 個 consumer（Event/Machine/Alert Service）一致地獲得修正後的行為。

## 能力

### 新能力

（無）

### 修改的能力

- `kafka-consumer-resilience`：既有的「consumer 錯誤邊界防止無限期停滯」需求（來自 `kafka-consumer-reliability-hardening`）新增一條需求：只有資料錯誤在 `handleMessage` 邊界被吞掉；其他錯誤傳播，讓 kafkajs 自己的重試機制處理。

## 影響

- **程式碼**：`backend/src/shared/kafka/kafka-consumer.base.ts`、新的 `backend/src/shared/kafka/error-classification.util.ts`、刪除 `backend/src/shared/kafka/retry.util.ts` + `retry.util.spec.ts`。`event-consumer.service.ts` / `machine-projection-consumer.service.ts` / `alert-consumer.service.ts` 不需要變更。
- **行為變更**：暫時性基礎設施失敗現在傳播到 kafkajs 自己的重試機制（帶抖動、預設約 5 次重試、最長約 30 秒），而不是被無聲丟棄（本提案之前的狀態）或被有 session timeout 風險的手工迴圈重試（選項 C 被撤銷的狀態）。格式錯誤/不可處理的訊息仍立即被記錄並跳過，不增加延遲（不像選項 C 對決定性失敗的訊息多花約 600ms 重試延遲）。
- **文件**：`openspec/changes/archive/2026-07-08-kafka-consumer-reliability-hardening` 的設計理由被本變更延伸（而非否定）— poison-pill 修復保留，本變更縮窄該邊界接住的範圍。
- **無 API 契約變更** — 純內部的 consumer 錯誤處理行為。
