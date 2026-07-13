## 脈絡

目前的程式碼（`backend/src/shared/kafka/kafka-consumer.base.ts`，第 27-43 行）：

```typescript
await this.consumer.run({
  eachMessage: async (payload) => {
    try {
      await this.handleMessage(payload);
    } catch (err) {
      this.logger.error(
        `Failed to process message: ${err}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  },
});
```

這是不分青紅皂白的 `catch`：每個錯誤不論原因都被記錄，訊息被視為已處理（kafkajs 提交 offset、移到下一則訊息）。今天有兩類本質不同的失敗流過這同一條路徑：

1. **資料有錯的錯誤** — 格式錯誤的 JSON（`JSON.parse` 的 `SyntaxError`）、值違反 schema 約束（例如 enum 之外的 `status`）產生的 Mongoose `ValidationError`/`CastError`，或任何原因是「這則特定訊息的內容有錯」的錯誤。重試同一則訊息每次都會以同樣方式失敗 — 在沒有死信佇列的情況下，跳過它是唯一理智的回應。
2. **暫時性基礎設施錯誤** — MongoDB 連線中斷、網路抖動、下游呼叫浮現的暫時性 Kafka broker 不可用。重試（或就讓程序崩潰、由 Docker 重啟、consumer 重連後 Kafka 重送）很可能成功。把這些與第 1 類同等對待，會無聲地丟掉一個完好的事件。

在這個 catch-all 存在之前，所有錯誤都會讓程序崩潰（透過容器重啟可見，且由於失敗訊息的 offset 從未提交，Kafka 會在重連時重送）。catch-all 修好了第 1 類的失敗模式（無限重試迴圈卡死整個 consumer group），但副作用是把第 2 類的失敗模式從「崩潰、最終經重送恢復」變成「無聲地永遠丟棄」。

## 目標 / 非目標

**目標：**
- 讓第 1 類 vs 第 2 類的取捨成為明確、有紀錄的決策 — 不是可靠性強化變更的意外副作用。

**非目標：**
- 不在本變更中為被跳過的訊息建立完整通用的可觀測性/告警管線（下面任一選項之後都能延伸，但解決這個決策不需要它）。
- 不重新爭論可靠性強化變更本身是否正確 — 它修的 poison-pill 問題是真的、修復保留；這裡只關於縮窄該邊界接住什麼。

## 決策

**修訂後的決策：選項 B（錯誤分類），取代先前選的選項 C。** 選項 C（帶退避的有限次重試）先被實作，之後在針對該實作的 `/code-review` 發現它引入的風險多於移除的風險後被撤銷 — 見下方選項 C 段落之後的「為什麼選項 C 被撤銷」。選項 A 與 C 保留在下方作為成文的替代方案而不刪除，因為這份比較與翻案的理由對之後重新檢視的人是有用的脈絡。

### 選項 A — 接受目前行為，記載為已知風險（未選）

程式碼什麼都不動。明確記錄（在此，或視需要在 `docs/design/architecture.md` 或類似的活文件）`KafkaConsumerBase` 對所有 `handleMessage` 失敗一視同仁：記錄一次、永遠跳過、不重試 — 包括暫時性基礎設施失敗。

**取捨：**
- ✅ 零實作成本、零新增複雜度。
- ✅ 一致、簡單的心智模型：「consumer 永遠不會卡住，就這樣。」
- ❌ 一個真實、有效的事件可能只因運氣不好（MongoDB 在錯的時刻抖一下）就被無聲且永久地遺失。對一個用合成資料、沒有 SLA 的 MVP/demo 專案，實務代價低 — 但它是真實的，而且若在 demo 期間發生，會以令人困惑的「為什麼這筆資料不見了」bug 的形式重現。
- ❌ 無聲資料遺失，除了一行日誌外沒有操作員可見的訊號（`kafka-consumer-reliability-hardening` 的設計文件已把這標為接受的風險，但那個表述特指格式錯誤的訊息 — 本選項把同樣的接受明確延伸到暫時性基礎設施失敗）。

### 選項 B — 分類錯誤：只在資料錯誤時跳過，讓基礎設施錯誤傳播（已選）

把 catch 區塊改為檢查錯誤，只有屬於「資料有錯」的錯誤類別才吞掉；其他一切重新拋出 — **不是為了直接讓程序崩潰，而是因為 kafkajs 自己的 `Runner` 已把每次 `eachMessage` 呼叫包在它自己的重試器裡**（經審閱 `kafkajs` 原始碼確認，`node_modules/kafkajs/src/consumer/runner.js` 與 `retry/defaults.js`：預設設定為 `{retries: 5, initialRetryTime: 300ms, factor: 0.2 jitter, multiplier: 2, maxRetryTime: 30000ms}`）。重新拋出的錯誤會先被 kafkajs 自己的重試迴圈接住 — 帶抖動、久經沙場、已是依賴 — 只有在 kafkajs 自己的重試額度耗盡時才讓程序崩潰，屆時 Docker 重啟容器、Kafka 在重連時重送（即強化前的復原路徑）。

```typescript
// backend/src/shared/kafka/error-classification.util.ts
import mongoose from 'mongoose';

export function isDataError(err: unknown): boolean {
  return (
    err instanceof SyntaxError ||             // JSON.parse failures
    err instanceof mongoose.Error.ValidationError ||
    err instanceof mongoose.Error.CastError
  );
}
```

```typescript
// kafka-consumer.base.ts
} catch (err) {
  if (isDataError(err)) {
    this.logger.error(`Skipping unprocessable message: ${err}`, ...);
    return; // swallow — commits the offset, moves to the next message
  }
  throw err; // let kafkajs's own retrier (jittered, already tested) handle it
}
```

**取捨：**
- ✅ 直接修好回歸：暫時性基礎設施錯誤重新獲得 kafkajs 自己的帶抖動重試（以及最後手段的崩潰加重送），格式錯誤的訊息仍不會卡死 consumer group。
- ✅ 小而受控的變更 — 一個分類 helper、無新依賴，而且比選項 C 的程式碼*更少*（沒有重試迴圈、沒有要自己寫/維護的退避計時器）。
- ✅ 沒有因我們自己的程式碼超過 consumer session timeout 的風險 — 我們不用手動重試延遲阻塞 `eachMessage`；kafkajs 的 runner 層重試已正確地照顧 consumer group 存活性（那是函式庫的職責，不是我們的）。
- ✅ 沒有重試整個多步驟 `handleMessage`、重做已成功副作用的風險，因為真正可重試的錯誤只會由 kafkajs 重新以全新的 `eachMessage` 呼叫重試 — 風險輪廓與強化前/這一切工作之前的行為相同，而那從未被標為問題。
- ❌ 分類清單（`SyntaxError`、`ValidationError`、`CastError`）是盡力而為的列舉，不是窮盡的 — 之後引入的新錯誤類型（例如未來換驗證函式庫）可能無聲地落入錯誤的桶，除非清單持續更新。這與本專案先前碰過的「會漂移的重複知識」是同一類（見 `docs/design/machine-schema.md` §5.4），只是形狀不同（型別檢查清單而非重複的述詞）。
- ❌ 持續的停機在 kafkajs 自己的重試額度（預設約 30 秒的 `maxRetryTime`）耗盡後，最終仍會讓容器崩潰循環（Docker 重啟、立即再失敗、重複）直到停機結束 — 對 side project 可接受，而且可以說比任何假裝能完全掩蓋持續停機的選項更誠實。

### 選項 C — 對所有錯誤做帶退避的有限次重試（曾選，後撤銷）

把 `handleMessage` 包在重試迴圈裡（3 次嘗試，第 2 次前延遲 200ms、第 3 次前延遲 400ms — 最後一次之後不延遲，因為那時已無可等待），之後才退回記錄後跳過。不需要分類 — 資料錯誤只會 3 次都以同樣方式失敗然後被跳過；暫時性錯誤在第 2 或 3 次有真實的成功機會。

```typescript
// backend/src/shared/kafka/retry.util.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 200,
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
    }
  }
  throw new Error('unreachable'); // satisfies TS control-flow analysis
}
```

`KafkaConsumerBase` 的 `eachMessage` 改為呼叫 `withRetry(() => this.handleMessage(payload))` 而非直接呼叫 `this.handleMessage(payload)`；既有的外層 `try/catch` 加記錄後跳過保留為所有嘗試耗盡後的最終 fallback。

**取捨（依原始評估 — 這個評估錯在哪，見下方撤銷理由）：**
- ✅ 沒有要保持同步的錯誤分類清單 — 在這個特定意義上，心智模型比選項 B 簡單。
- ✅ 處理的暫時性問題類別比選項 B 的固定 enum 更廣（例如負載下慢但終究成功的 Mongo 寫入，不只是徹底的連線失敗）。
- ❌ 更重：把重試/退避邏輯與時間行為引入熱路徑 — 每則碰到真實資料錯誤的訊息現在要多花約 600ms 才失敗（3 次嘗試之間的 200ms + 400ms 延遲）才被跳過，而選項 B 是立即失敗。
- ❌ 重試發生在單次 `eachMessage` 呼叫**之內**，所以重試期間 consumer 對同分割區的其他訊息毫無進展 — 對單分割區 topic（目前的 MVP 設定，見 `docs/deployment/docker-compose.md` §4），這表示一則訊息的重試延遲擋住它後面的一切，每則壞訊息可能讓整條管線可見地停滯最多約 600ms。**當時接受**：評估為在 MVP/demo 規模下不是問題 — 這個評估本身沒錯，但看下方*真正*被遺漏的風險。
- ~~三個選項中最複雜、最難正確實作與推理的。以把 `withRetry` 保持為小型、通用、無依賴的工具來緩解（與 kafkajs 自己的 consumer 層重試設定沒有互動 — 它完全在單一 `eachMessage` 呼叫內運作，在 kafkajs 自己的重試/心跳機制介入之前）。~~ **這個宣稱是錯的** — 見下方。

### 為什麼選項 C 被撤銷

針對實際的 `retry.util.ts` + `kafka-consumer.base.ts` 實作（建好並手動驗證可運作之後）的 `/code-review` 發現兩個嚴重到值得翻案而非修修補補的缺陷：

1. **上面「與 kafkajs 自己的 consumer 層重試設定沒有互動」的宣稱在事實上是錯的。** kafkajs 的 `Runner` 已把每次 `eachMessage` 呼叫包在它自己的帶抖動重試器裡（`node_modules/kafkajs/src/consumer/runner.js` + `retry/defaults.js`）。因為 `KafkaConsumerBase` 的外層 `try/catch` 在每個錯誤能抵達 kafkajs 的 runner 之前就吞掉它，那個內建機制被無聲地變成死程式碼 — `withRetry` 是這個專案已依賴的函式庫中既有功能的手工、無抖動複製品。沒有抖動意味著共享停機後多個 consumer 以同步波次而非錯開地重試，恰恰惡化重試邏輯本要避免的「剛恢復的依賴又被重新壓垮」情境。
2. **在單次 `eachMessage` 呼叫內重試慢慢失敗（而非快速失敗）的操作、重試期間沒有 `heartbeat()` 呼叫，可能超過 consumer 的 session timeout 並觸發 group rebalance。** kafkajs 只在 `eachMessage` 呼叫*之間*呼叫 `heartbeat()`，從不在呼叫之中。在真實（非短暫）的 MongoDB 停機期間，mongoose 自己約 30 秒的預設 `serverSelectionTimeoutMS` 表示 3 次重試各可能阻塞最多約 30 秒，所以單次 `eachMessage` 呼叫可能阻塞 90 秒以上、零心跳 — 輕鬆超過 kafkajs 預設的 30 秒 session timeout，讓 consumer 在重試途中被踢出 group。這與可靠性目標背道而馳：這個「修復」恰恰可能在它想幫忙的持續停機情境中引入新的失敗模式（rebalance 抖動）。

第三個較窄的問題強化了這個決定：重試*整個* `handleMessage`（而非只重試失敗的子操作）意味著單一失敗的寫入可能觸發最多 3 倍的冗餘 DB 讀寫，而且特別是在 `alert-consumer.service.ts` 中，重試時重跑整個 handler 導致 `resolveAlert` 每次嘗試都重新抓取機台狀態 — 表示一個暫時性、不相關的失敗可能在重試之間機台狀態改變時，無聲且永久地丟掉一個正當的告警，沒有任何錯誤或日誌指出這個損失。

選項 B 避開全部三者：沒有自訂重試迴圈（所以沒有抖動缺口、沒有無心跳的阻塞），且真正可重試的錯誤由 kafkajs 重新發起*全新的* `eachMessage` 呼叫處理（不是手工巢狀的重試迴圈），所以沒有「連同已抓取的狀態重試整個 handler」的問題。

## 比較

| | 選項 A（接受） | 選項 B（分類，已選） | 選項 C（重試，已撤銷） |
| --- | --- | --- | --- |
| 實作成本 | 無 | 小 | 中 |
| 修復暫時性錯誤的資料遺失 | 否 | 是（經 kafkajs 自己的帶抖動重試，最後手段為崩潰+重送） | 部分（只在約 600ms 重試窗內解決時，且前提是沒被下面的 session-timeout 風險弄壞） |
| 要維護的新元件 | 無 | 一份錯誤類型允許清單 | 重試/退避邏輯（手工、無抖動） |
| 漂移/過期風險 | N/A | 允許清單可能漏掉新錯誤類型 | N/A |
| 重試帶抖動（避免同步重試風暴） | N/A | 有 — 繼承自 kafkajs | 無 |
| 超過 consumer session timeout 的風險 | 無 | 無（kafkajs 自己的重試器有照顧 session timeout） | 有 — code review 確認 |
| 重試時重做已成功副作用的風險 | 無 | 無 | 有 — code review 確認（重試整個 `handleMessage`，不只失敗的步驟） |
| happy path 增加的延遲 | 無 | 無 | 無 |
| 跳過壞訊息時增加的延遲 | 無 | 無 | 約 600ms（3 次嘗試） |
| 符合專案「實作重量對應目前真實壓力」原則（`docs/design/architecture.md` §14.2、`docs/design/machine-schema.md` §5.4） | 最貼合 — 尚無真實壓力 | 合理 — 小、有針對性，且倚靠已被測試的函式庫功能而非重新發明 | 事後證明相對於它重新發明的東西既過度建造*又*測試不足 |

## 遷移計畫

無資料遷移。刪除 `backend/src/shared/kafka/retry.util.ts` 及其測試；新增 `backend/src/shared/kafka/error-classification.util.ts`。純粹是 `KafkaConsumerBase` 內的行為變更；以正常的後端重建部署。

## 未決問題

無 — 選了選項 B（在 code review 發現最初選的選項 C 有缺陷而撤銷之後）；見上方決策。
