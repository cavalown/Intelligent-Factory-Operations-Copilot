# Observability Review Lessons（2026-07）

涵蓋對 `add-observability` change（OpenTelemetry instrumentation、`nestjs-pino` 結構化日誌、`ifoc.events.processed` metric、`lgtm` compose 服務）的 `/code-review` 檢視。這次審查確認了 7 個發現;本文件記錄背後的 5 個根本原因模式,因為其中兩個是這個專案**已經寫下來過的模式的重演** —— 這裡真正有用的教訓不是那些個別的 bug,而是為什麼「把一個模式寫下來一次」並不足以阻止它在另一個檔案裡以不同形狀重新發生。修正都在同一個 change 裡出貨(`tasks.md` §6)。

---

## 模式 1:新程式碼被插進一條既有的錯誤分類 pipeline 裡,卻沒有對照那條 pipeline 自己的規則檢查過 —— 一次對先前已記錄模式的直接重演

**這個 bug:** `KafkaConsumerBase.onModuleInit` 的 `eachMessage` handler 在一個 `try` block 裡呼叫 `await this.handleMessage(payload)`,接著(這次 change 新加的)在同一個 block 裡呼叫 `this.recordProcessed(payload)`。`recordProcessed` 重新用 `JSON.parse` 解析了這則 Kafka 訊息,而且沒有檢查解析結果是否為 null,就直接存取 `envelope.correlationId`。一則訊息如果 value 剛好是字面上的 4 個位元組 `null`,那是合法的 JSON —— `JSON.parse('null') === null` —— 所以解析會成功,緊接著那一行就丟出 `TypeError: Cannot read properties of null`。這個 `TypeError` 一路傳到外層的 `catch`,而 `isDataError()`(`error-classification.util.ts`)只認得三種型別 —— `SyntaxError`、`mongoose.Error.ValidationError`、`mongoose.Error.CastError` —— 認不出 `TypeError`,所以錯誤被重新丟出、進到 kafkajs 的重試路徑,而不是被當成無法處理的訊息吞掉。一則注定會一直失敗的錯誤 envelope,就會被一模一樣地永遠重試下去。

**為什麼會發生:** 這幾乎是逐字重演了 `docs/retrospectives/2026-07-dashboard-metrics-review-lessons.md` 的模式 1:「一個次要的寫入(操作)被放進主要(路徑)的關鍵路徑裡,而它的失敗模式從來沒有拿去對照過 pipeline 的錯誤分類規則。」那份回顧記錄的是一個*寫入*操作(一筆狀態轉換的 insert)落進跟主要投影儲存同一個 try block;這次則是一個 telemetry 的*讀取/記錄*操作落進跟訊息處理同一個 try block。操作不同,錯誤的形狀卻一模一樣:新程式碼被加進一個既有的 try/catch,而它的 catch 分支有一份具體、列舉式的合約(`isDataError` 認得的那三種型別),新程式碼自己可能丟出的錯誤類型卻從來沒有拿去對照過那份合約。模式 1 說該問的那個問題 ——「我的新程式碼可能丟出的每一種錯誤,週遭的基礎設施會怎麼處理它?」—— 就寫在同一個 repo 裡,寫在一份談論同一個檔案的姊妹關注點的文件裡,而當不同種類的程式碼被加進同一個 try block 時,這個問題並沒有被重新問一次。

**如何避免:** 第一次發生時學到的教訓,需要從它原本的形狀(「不要加*寫入*」)推廣到更一般的形狀(「不要加*任何可能丟出例外的程式碼*」),才能真正被遷移過去。具體來說:在把*任何*一行敘述加進一個帶有錯誤分類 catch 的既有 try block 之前,先問這行新敘述可能產生哪些例外型別,再逐一對照 catch 那份列舉清單 —— 不是只問「這通常會不會成功」,而是問「這在一個格式錯誤/邊緣情況的輸入下會丟出什麼,而那個型別在清單裡嗎」。如果不在清單裡,新程式碼要嘛需要自己的防護(見模式 2 的修法),要嘛分類器的清單需要刻意地、而不是意外地擴充。

---

## 模式 2:一個 metric 的「成功」標籤是用「週遭程式碼沒有丟出例外」來定義的,而不是用領域本身定義的成功

**這個 bug:** `ifoc.events.processed` 計數器(以及 `ifoc.correlation_id`/`event_id`/`event_type` span 屬性)只要 `handleMessage()` 沒有丟出例外就完成 resolve,就會被記錄。但「丟出例外」從來就不是一則訊息變成 no-op 的唯一方式:`MachineProjectionConsumerService` 對一個無法辨識的 `eventType` 會提早 return(不丟例外),註解寫著「整個跳過,不要標記為已處理」;`EventConsumerService` 和 `AlertConsumerService` 都會在重新投遞時捕捉一個 Mongo duplicate-key 錯誤,當成冪等的 no-op 直接 return;`MachineProjectionConsumerService` 對不明的 `machineId` 或已經套用過的 `eventId` 也會提早 return;`AlertConsumerService` 在事件根本不需要建立 alert 時也會提早 return。以上每一個都是刻意、正確、不會丟出例外的跳過 —— 而每一個都依然被算成「成功處理」,因為 counter 的觸發條件(「沒有丟出例外」)跟領域實際的成功條件(「造成了真正的效果」)並不是同一個判斷式,而沒有任何東西強制這兩者必須一致。

**為什麼會發生:** `Promise<void>` 不帶任何訊號。`handleMessage` 的抽象簽章什麼都不回傳,所以呼叫方唯一能取得的資訊就是「有沒有丟出例外」——一個早就被借去做完全不同用途的布林值(重試分類,見上面的模式 1)。把「沒有丟出例外」拿來當「成功」的替身,是一個很容易、也很不容易被察覺的偷換,因為在*常見*情況下(一個真正被處理的事件)這兩個條件是一致的 —— 這個 bug 只會在跳過路徑上現形,而那正好是這次 change 自己的驗證(task 5.1,只跑了一個成功套用的事件)不會測到的路徑集合。五個被誤計的跳過路徑裡,有一個 —— 無法辨識的 `eventType` 那個 —— 本身就是一份*已經封存*的 change(`archive/2026-07-08-kafka-consumer-reliability-hardening` 的「無法辨識的事件型別不應更新投影或標記為已處理」)裡那條規則的復活,而且是被同一個人、在同一個檔案裡、就在自己寫下那條領域層規則的幾行之後,在新的一層(metric/tracing 程式碼)重新違反了一次。

**如何避免:** 當一個 metric 或 span 想代表的是一個領域概念(「已處理」、「成功」、「已套用」)而不是控制流事實(「沒有丟出例外」)時,就該給發出訊號的程式碼一個明確的訊號機制 —— 回傳值、result type、事件 —— 而不是從有沒有丟例外去反推。這裡的修法:`handleMessage` 現在回傳 `Promise<boolean>`,只有真正產生效果才是 `true`,metric 只在 `true` 時才觸發。更一般地說:在把一個新的可觀測性訊號接到一個既有函式的控制流之前,先問這個函式自己的邏輯裡是不是早就在某處區分了「no-op」跟「有做事」(通常有 —— 五個跳過路徑每一個都已經有自己的註解解釋*為什麼*那是個 no-op)—— 如果有,該暴露出來的是那個既有的區分,而不是從外面重新推導一次。

---

## 模式 3:手刻的管線邏輯,在這次 change 自己的設計文件明確說要避免的那個確切地方,又重新出現了

**這個 bug:** `instrumentation.ts` 用一個本地的 `otlpUrl` helper 組出每個 OTLP exporter 的 URL —— 讀取 `env.otelExporterOtlpEndpoint`,再用字串拼接一個寫死的 resource path(`/v1/traces`、`/v1/metrics`、`/v1/logs`)—— 然後把它當成明確的 `url` 傳給 `OTLPTraceExporter`/`OTLPMetricExporter`/`OTLPLogExporter`。實際讀 `@opentelemetry/otlp-exporter-base` 的原始碼發現,這幾個 exporter 本來就會自己做一模一樣的解析 —— 甚至會先檢查*訊號別*的環境變數(`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` 等)才退回通用的那個 —— 但只有在建構子沒有拿到明確的 `url` 時才會這樣做。而手刻的 helper 傳了一個,等於悄悄停用了這個解析機制 —— 任何設定過訊號別 endpoint 的人都會被無聲忽略。

**為什麼會發生:** 這次 change 自己的設計文件(`design.md` D1)明明白白寫出了指導原則:「auto-instrumentation 優於手刻 span……auto-instrumentation 涵蓋 HTTP/Mongoose/kafkajs,包括透過 Kafka header 的 context propagation —— 手刻那個 propagation 正是[第一份回顧的]模式 3 警告的那種基礎設施重複」。這個原則在它被陳述的規模上被正確地套用了(沒有手刻 span、沒有手刻 Kafka header propagation、也沒有手刻 pino mixin —— instrumentation-pino 會自動處理 trace 注入跟 log 轉送,這正是這次 session 明確做出的設計選擇)。但 URL 組合 —— 十三個字元的 `.replace(/\/$/, '')` 加上一個模板字串 —— 看起來不像「基礎設施」,所以沒有觸發跟那些大決定一樣的「先檢查 library 是不是早就做了這件事」反射動作。這跟第一份回顧的模式 3(自己刻了一個已經在用的 library 早就提供的東西)是同一類錯誤,只是規模小到不像一個值得寫下來的設計決策 —— 而這正是它為什麼能溜過一個在這次 change 裡、對更大的決定正被正確且積極套用著的原則。

**如何避免:**「這個 library 是不是早就做了這件事」這個問題沒有規模門檻 —— 它對一個十三個字元的字串 helper,跟對一個重試迴圈,一樣適用。一個好用的觸發點:每當新程式碼在讀一個環境變數、*而且*附近正在建構一個第三方 client/exporter/SDK 物件時,先檢查那個建構子是不是自己就會讀那個環境變數,再決定要不要手動接線 —— 讀環境變數正是設計良好的 SDK(尤其是像 OpenTelemetry 這種照規格走的)理所當然會幫你做的事,手寫的橋接預設就是多餘的,而不是例外。

---

## 模式 4:為了啟動順序上的方便加了一條依賴邊,卻沒有檢查它在唯一真正需要撐住的那條路徑上的代價

**這個 bug:** `docker-compose.yml` 的 `backend` 服務在 `depends_on` 清單裡加了 `lgtm`。Compose 的 `depends_on`(沒有 health condition)只會等依賴的容器「啟動」,不會等它「就緒」——這對「順序」來說已經夠用,但這也表示如果依賴根本啟動失敗,dependent 服務就會被卡住。`grafana/otel-lgtm` 是一個龐大、多元件的 image;在一次全新的 clone、離線環境,或是 Docker Hub 的 rate limiting 底下,它的 pull 可能會失敗 —— 而且已經實際重現過(用一個最小化的 repro compose 檔案):這個失敗會讓 `backend` 完全無法啟動,即使 `backend` 實際的執行期行為根本不需要 `lgtm` 存在(同一次 change 自己的文件跟設計文件裡,每一句 fail-soft 的說法講的都是「`lgtm` 在整個堆疊已經在運行之後被停掉」,從來沒有涵蓋過它一開始就啟動失敗的情況)。

**為什麼會發生:** 啟動順序感覺像是不花錢的文件價值 ——「kafka、mongodb、lgtm 先啟動,接著 backend」是一句很乾淨的句子 —— 而 `depends_on` 剛好是手邊現成可以拿來表達這件事的工具。但這次 change 自己的設計目標(D5:「backend 在有沒有 observability 容器的情況下行為完全一樣」)其實早就暗示了 `backend` 在任何時間點(包括啟動時)對 `lgtm` 的執行期需求是零 —— 所以根本沒有東西是這個順序真正在保護的。這條依賴邊會被加上去,是因為加起來很簡單、看起來也無害,而不是因為下游有任何東西真的需要它;它唯一真正的效果(把 `backend` 自己啟動能不能成功,綁在一個無關容器的 image pull 上)從來沒有拿去對照那個原本就讓它變得沒必要的設計目標檢查過。

**如何避免:** 在加一條 `depends_on`(或任何順序/耦合的機制)之前,先問「沒有它,具體會壞掉什麼」—— 不是「順序好看一點會不會比較好」,而是「有什麼可觀察的行為,是需要 B 存在才能讓 A 運作的」。如果誠實的答案是「什麼都不會壞,A 要很久以後才會碰到 B,而且能夠容忍 B 一直不存在」(這裡本來就是這樣,而且同一次 change 自己的設計文件早就寫下來了),那這條邊就是有實際成本(A 的啟動現在要靠 B 自己成功)、卻沒有任何抵銷的好處,就不該加。

---

## 模式 5:一項任務被標記完成,靠的是周遭工作感覺完成了多少,而不是那項任務自己陳述的情境有沒有真的被驗證過

**這個 bug:** `tasks.md` 的任務 2.3(「確認一個強制的 5xx 同時出現在存取日誌與帶錯誤的 trace span」)被打勾標成 `[x]`——但它自己的註記明明承認,強制 5xx 的重現嘗試過、失敗了(卡在 Mongoose 預設 30 秒的 `serverSelectionTimeoutMS` 緩衝上),而且從來沒有真的完成過;checkbox 還是被打勾了,因為周遭的工作(存取日誌、trace 關聯)確實已經做完並驗證過。另外,`tasks.zh-TW.md`——這個專案對 `openspec/` 底下每一份 `tasks.md` 的既有慣例——完全沒有被更新,導致它顯示全部 13 項任務都還沒開始,而英文版卻顯示整個 change 已經完成,還附上詳細的驗證註記。

**為什麼會發生:** 這兩件事是同一種疏忽的不同實例:把一個 checklist 項目當成「這個大方向做完了」的代理指標,而不是當成 checkbox 旁邊那句話的字面宣稱。任務 2.3 把兩個宣稱(存取日誌可以運作;5xx 會讓 span 標記為錯誤)綁進同一個 checkbox —— 第一個徹底驗證過了,而那份驗證帶來的信心,連帶把第二個沒驗證過的宣稱也一起打勾了。zh-TW 漏掉的情況是同一種失誤在檔案層級的版本:同一次 change 裡有十一份其他檔案都做了雙語更新(文件、architecture、compose 檔自己的文件),所以整個*change*感覺起來雙語已經完成了,而剩下那一份檔案 —— 一份 checklist,不是任何人會主動重讀的散文 —— 就沒有被逐一拿去對照這個慣例檢查過。

**如何避免:** 一個 checkbox 的宣稱就是它旁邊那句話的字面意思,不是周遭那段文字給人的整體感覺。在打勾之前,重新讀一次那句話的字面內容,問「*那句具體的話*有沒有被驗證過」—— 而不是問它所屬的功能領域感覺完不完整。對於有明訂雙語同步慣例的多語言 repo,要把「同步」本身當成一個有自己明確驗證步驟的 checklist 項目(例如:對這次改動到的每一份 `.md`,最後做一次 `git status` 掃描,逐一對照它的 `.zh-TW.md` 對照版)去處理,而不是因為大部分檔案都做到了,就假設這件事已經發生。
