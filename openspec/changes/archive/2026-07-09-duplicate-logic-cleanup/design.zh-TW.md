## 脈絡

本變更打包 4 個低嚴重度的 code-review 發現，它們不像 `kafka-consumer-reliability-hardening` 的發現那樣共享單一根因 — 它們被歸在一起，是因為與另一個變更不同，在正常運作下沒有一個影響執行期正確性。唯一值得仔細設計的例外是感測器故障契約測試，因為它是 `machine-schema.md` §5.4 探索工作階段決策的具體後續（保持 Machine Service 與 Alert Service 結構獨立；用契約測試而非共用商業邏輯模組，因為 `ai/rules/module-boundaries.md` 禁止 `shared/` 放商業邏輯）。

## 目標 / 非目標

**目標：**
- 修好那個真實（雖輕微）的 bug：`limit=0` 被無聲忽略。
- 移除重複實作且無行為變更（`isDuplicateKeyError`、死的型別別名）。
- 加入一個契約測試，讓 Machine Service 與 Alert Service 各自獨立的「這個 STATUS_CHANGED 是不是感測器故障」分類再度不一致時大聲失敗，且不合併它們的實作。

**非目標：**
- 不解決專案更廣的「自動化測試策略未定案」開放問題（`ai/rules/testing.md`）— 本變更只加恰好一個窄範圍的測試，使用 NestJS 已搭好的 Jest 設定（`npm test` 已會跑 `backend/src/` 下的 `*.spec.ts`；這是加法，不是新的測試框架決策）。
- 不抽取兩個服務之間的溫度閾值重複（探索工作階段也點名過）— `machine-schema.md` §5.4 明確把它延到 Phase 2 的 Rule Engine，而且它是另一段（目前一致的）重複邏輯，不是真正漂移了的那段。
- 除了讓分類邏輯可測所需外，不動兩個 consumer 的實際分類邏輯（見決策 2）— 目標是抓漂移，不是改變今天的行為。

## 決策

### 1. `isDuplicateKeyError` 移到 `backend/src/shared/database/mongo-error.util.ts`

依 `ai/rules/module-boundaries.md`，`shared/` 給「型別、DTO 與橫切基礎設施……不放商業邏輯」。MongoDB 錯誤代碼檢查是基礎設施（它關乎資料庫 driver 的錯誤形狀，不是這個應用的商業規則），所以它屬於 `shared/database/`（與 `database.module.ts` 同處）而非 `shared/kafka/` — 儘管今天的兩個呼叫端都是 Kafka consumer，這個檢查本身與 Kafka 無關。`event-consumer.service.ts` 與 `alert-consumer.service.ts` 都 import 並呼叫共用函式，不再各自定義私有副本。

### 2. 契約測試需要每個服務的分類邏輯可以獨立呼叫 — 每個服務抽出一個小的純函式，彼此不共用

要在不合併程式碼的前提下測試「Machine Service 的分類是否與 Alert Service 的分類一致」，每個服務需要把它的感測器故障檢查抽成一個小型、可獨立測試的純函式：

```typescript
// still inside machine-projection-consumer.service.ts, not shared:
function isStatusChangedSensorFailure(currentStatus: string): boolean {
  return currentStatus === 'WARNING';
}

// still inside alert-consumer.service.ts, not shared:
function isStatusChangedSensorFailure(currentStatus: string): boolean {
  return currentStatus === 'WARNING'; // fixed: was `!== 'WARNING'` (inverted)
}
```

兩個檔案各得到一個*同名同邏輯*的函式，但彼此之間沒有共用 import — 這是依 `machine-schema.md` §5.4「保持兩個服務結構獨立」的決策而刻意為之。契約測試 import 兩個函式，對共用的 fixture 清單斷言它們一致。這也順帶直接修好了發現 #9 的相反極性 — 該 bug 是 code review 抓到的，而把邏輯抽成具名、可測試的函式，正是讓「這兩個不一致」變成一行測試斷言（而不是只能靠人工檢查）的方法。

曾考慮的替代方案：什麼都不抽，寫一個整合式測試，把 Kafka 訊息餵過兩個真實 consumer 並檢查它們的 MongoDB 寫入。否決 — 重得多（需要本專案還沒有的 Kafka/Mongo 測試基礎設施），且測到的比實際漂移點更多；針對兩個抽出的述詞的聚焦單元測試更便宜，抓這類特定 bug 同樣有效。

### 3. `limit=0` 修復：明確的 `undefined` 檢查，不是 truthy/falsy 重寫

```typescript
// before:
const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
// after:
const rawLimit = query.limit !== undefined ? Number(query.limit) : DEFAULT_LIMIT;
const limit = Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
```

`limit=0` 現在以 `0` 流入，然後被既有的 `Math.max(..., 1)` 截限到 `1` — 即修復的範圍是「停止把 0 誤分類為未提供」，不是「允許真正的零大小頁面」（0 大小的頁面是不值得支援的退化情況；截限到 1 符合既有記載的最小有用行為）。

## 風險 / 取捨

- **[風險] 兩個 `isStatusChangedSensorFailure` 函式仍需由編輯其中一個的人手動保持同步** — 契約測試只在漂移*發生後*（測試執行時）抓到，不是在編輯時。→ **緩解**：接受；這正是依 `machine-schema.md` §5.4 選擇契約測試而非共用程式碼的全部意義 — 它是更便宜、更低耦合的安全網，不是結構性保證。Phase 2 的 Rule Engine 才是結構性修復。
- **[風險] 這是 codebase 的第一個真正單元測試**（`app.controller.spec.ts` 是沒動過的 Nest 骨架 stub）— 在更廣的測試策略決策尚未做出時立下隱含先例。→ **緩解**：刻意界定得很窄（見非目標）；在此明確標記，讓它被理解為「恰好是這個特定問題的正確工具的一個測試」，而不是「測試策略已經定案」。

### 補遺：第二輪 code-review 浮現、此處未解決的開放問題

針對本變更自身實作的第二次 `/code-review`（見 `proposal.md` 的「更新」註記）發現 `KafkaConsumerBase` 的 catch-all（來自 `kafka-consumer-reliability-hardening`）一視同仁地吞掉 `handleMessage` 的**每一個**錯誤 — 不只是格式錯誤的「poison pill」訊息，也包括暫時性基礎設施失敗（例如 `.save()` 進行中 MongoDB 連線中斷）。3 個子類別自己的 `catch (err) { if (isDuplicateKeyError(err)) return; throw err; }` 模式是在假設 `throw` 會傳播並讓程序崩潰（讓暫時性失敗透過容器重啟可見、然後在 Kafka 重連重送時自然重試）的前提下寫的。現在基底類別在上一層接住一切，那個 `throw` 只是像任何其他錯誤一樣被記錄後跳過 — 一個只因暫時性停機而失敗的完好事件，如今被無聲地永遠丟棄而不是被重試。

這是真實的設計問題 — 區分「永遠跳過也安全」（格式錯誤的資料）與「應該被重試」（暫時性基礎設施）需要錯誤類型分類法（例如基底類別只接 `SyntaxError`/`ValidationError`/`CastError`、其餘傳播）或帶退避的重試層，兩者都不是一行修復。**本變更不解決** — 依本專案「不單方面解決非顯而易見的設計決策」的工作規範，浮報給使用者決定而非默默挑一個。

## 遷移計畫

無資料遷移。純加法/重構：`isDuplicateKeyError` 行為不變（同一檢查、新位置）；死型別別名的移除無執行期影響（僅 TypeScript）；`limit=0` 修復改變一個邊界情況的回應。以正常的後端重建部署。
