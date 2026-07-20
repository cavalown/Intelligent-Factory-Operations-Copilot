# Rule Engine Review Lessons(2026-07)

涵蓋對 `add-rule-engine` 這個變更(計算一次 `temperatureExceedsThreshold`/`isSensorFailure` 並重新發布的富化 consumer,取代 `docs/design/machine-schema.md` §5.4 記錄為 MVP 接受風險的、各服務重複分類的做法)所做的 `/code-review`。這次審查確認/判定為合理的 findings 共 10 個,橫跨正確性、測試覆蓋、型別安全、文件,以及慣例遵循。全部 10 個都在同一次變更裡修正(`tasks.md` §6)。本文件記錄背後的 6 個根本原因模式。這次的headline 模式甚至不是一個程式碼錯誤:10 個 findings 裡有 3 個,是同一個 agent、在同一個 session 裡,已經在*前一個*變更上正確套用過的慣例 —— 卻沒有再套用到這個變更自己的新 artifact 上。做對一次,即使是幾分鐘前才做對,並不會讓第二次自動做對。

---

## Pattern 1:把邏輯合併到新的單一真實來源時,帶走了比較邏輯本身,卻掉了原本擺在它旁邊的防呆

**問題:** 兩個 finding,同一種形狀。第一個:`RuleEngineConsumerService` 計算 `temperatureExceedsThreshold = event.payload.temperature > machine.temperatureThreshold` 時完全沒有 `Number.isFinite(temperature)` 檢查 —— 但這段邏輯是從哪兩個呼叫點合併*過來*的(`MachineProjectionConsumerService`、`AlertConsumerService`),那兩個呼叫點都有這個防呆,就緊接在它們各自那份同樣比較邏輯的正上方。一個非有限值的溫度,原本會被悄悄分類成 `temperatureExceedsThreshold: false` —— 一個捏造出來的「門檻內」宣稱 —— 而不是像未知機台那樣被當成無法分類。第二個:`handleMessage` 無條件回傳 `true`,連未知機台這個 no-op 情境也是,即使 `ai/rules/observability-conventions.md` —— 一條這個 consumer 的基底類別(`KafkaConsumerBase`)存在的目的正是要讓人容易遵守的規則 —— 字面上就列舉了「未知機台」是需要回傳 `false` 的情境。

**為什麼會發生:** 當邏輯從 N 個重複的呼叫點合併到一個新的呼叫點時,*正面*邏輯(比較本身)是明顯需要被寫出來的那部分,所以它會被寫出來、也會被注意到。擺在舊呼叫點旁邊的*防禦性*邏輯 —— 那些防呆分支、「這種輸入回傳 false」的分支 —— 並不是任何 task list 上單獨的一項;它是隱含在舊呼叫點裡的上下文,必須被主動注意到並在新位置重新加回去。`tasks.md` 原本的 task 2.2 完全沒說「也要把 Number.isFinite 防呆搬過來」—— 它只說了要計算什麼,沒說要防範什麼,因為這個防呆的必要性從新 consumer 自己的程式碼裡看不出來,只有從即將被取代的那兩個舊 consumer 才看得出來。

**如何避免:** 把重複的邏輯從 N 個地方合併到一個地方時,不要只 diff *正面*邏輯(它們算的是不是同一件事)—— 也要 diff 它周圍的*防呆*(它們在計算之前驗證的是不是同一組前提)。讀完每個即將退役的舊呼叫點周圍的完整函式,而不只是要搬動的那一行,並且在假設同一行可以在新位置、沒有鄰居陪著也一樣安全執行之前,先問「是什麼讓這一行*在那裡*可以安全執行」。

---

## Pattern 2:design doc 自己明確、自我要求的規定,寫在文字裡,卻從來沒有變成 checklist 上的一項

**問題:** `design.md` 的風險章節在討論被刪除的契約測試時寫道:「它的替代品是對 Rule Engine 自己分類邏輯的直接測試覆蓋(tasks.md 應該明確把它列進去,不要留成隱含的)。」這已經是一個自我要求能寫得多明確的極限了 —— 它甚至點名了要避免的確切失敗模式(「不要留成隱含的」)。`tasks.md` 的驗證章節(5.1–5.5)還是照樣只有手動/現場 demo 的步驟出貨;checklist 裡完全沒有任何針對 Rule Engine 分類邏輯的單元測試任務。

**為什麼會發生:** 這比 observability 回顧報告的 Pattern 5(「一個任務基於周圍工作感覺做完了就被標記完成」)更窄、更字面 —— 那次是一個 checkbox 已經存在,卻過早被打勾。這次是完全沒有 checkbox 存在。design doc 被寫出來,它的風險章節在寫下這個要求的同一口氣裡就標記了它,然後序列裡緊接著的下一個 artifact(tasks.md)在起草時,沒有把那句具體的話回頭對照成一個任務項目。這個要求在被寫下的當下是正確且明確的,但「把它寫成一項要求」跟「把它轉換成一個被追蹤的任務」是兩個不同的動作,而只有第一個真的發生了。

**如何避免:** design doc 的風險/取捨章節裡,任何一句規定了具體後續行動(一個測試、一個文件更新、一個遷移步驟)的話,光是存在於 design doc 裡並不算被滿足 —— 在 artifact 序列被視為完成之前,`tasks.md` 裡需要有一行字面上對應的任務。起草 `tasks.md` 時,對 design doc 做一次祈使/規定性語言(「應該包含」、「需要」、「必須」)的 grep,並檢查每一個都有對應的任務,而不是相信「把要求寫下來一次」就足以讓它發生。

---

## Pattern 3:同一個檔案裡已經用在類似情境的結構性保護,沒有延伸到同樣形狀的新欄位上

**問題:** `MachineEventEnvelope<TEventType, TPayload>` 裡的 `payload: TPayload` 是依 discriminated union 的每個成員各自限定範圍的 —— `TemperatureReportedEvent` 的 `payload` 是 `TemperatureReportedPayload`,`StatusChangedEvent` 的是 `StatusChangedPayload`,而且 TypeScript 的 discriminant narrowing 會在每個讀取點強制這件事。兩個新的分類欄位(`temperatureExceedsThreshold`、`isSensorFailure`)卻直接被加在共用的 `MachineEventEnvelope` 基底上,所以 `MachineEvent` union 的每個成員名義上都帶著這兩個欄位,不論相不相關 —— 型別系統本來沒辦法抓到未來在 `ERROR_OCCURRED` 分支裡讀取 `event.isSensorFailure`,即使對 `payload` 做一模一樣的錯誤*會*是編譯錯誤。

**為什麼會發生:** 「怎麼把一個欄位限定範圍到特定事件類型」的可運作範例,就擺在同一個檔案裡,只差幾行,做的正是新欄位需要的那件事 —— 但它沒有被認出是可以照抄的範本,因為它看起來不像同一個問題。`payload` 依成員限定範圍存在的理由,是因為每種事件類型的 payload 形狀顯然不同(完全不同的欄位名稱);新欄位卻是在用到它們的兩個成員之間,單一、統一的 `boolean` 形狀,讀起來像是「就加進基底吧,反正到處都是同一個型別」—— 需要被限定範圍的是*相關性*、不是*形狀*,這件事從欄位自己的型別簽章裡並不明顯。

**如何避免:** 在為 discriminated union 加一個只對部分成員有意義的欄位時,要問的問題不是「這個欄位到處的型別是不是一樣」—— 而是「當 discriminant 對不上時,程式碼應不應該被允許讀寫這個欄位」。如果答案是不應該,就把它限定範圍到特定的成員型別上(透過交集型別或成員專屬介面),即使這個欄位在它出現的每個成員上形狀都一模一樣。

---

## Pattern 4:同一個 agent 在同一個 session 早些時候已經正確套用過的慣例,沒有被重新套用到這個 session 稍後的工作上

**問題:** 三個獨立的 finding,同一個根本原因。(a)`add-rule-engine` 六個新的 OpenSpec artifact 一個都沒有 `.zh-TW.md` 對照版,違反 `ai/rules/bilingual-docs.md` 明確的範圍 —— 即使就在這同一個 session 裡、更早之前,同一個 agent 才剛正確地為*前一個*變更(`add-observability`)的每一個 artifact 建立了完整的 `.zh-TW.md` 對照版才把它封存。(b)`backend/.env.example` 從來沒有補上新的 `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED` 變數,即使 `docker-compose.yml`、`docker-compose.md` §5,以及 `local-development.md` 在同一個登記表 sweep 任務裡都補上了 —— `.env.example` 跟另外三個是同一*類別*的「Kafka topic 環境變數清單」,只是 sweep 的心智 checklist 沒有包含的第四個位置。(c)新的 consumer group 被命名為 `rule-engine-group`,打破了前面三個 consumer 完全遵循的 `<module>-service-group` 樣式(`event-service-group`、`machine-service-group`、`alert-service-group`)—— 這個名字是從功能的名稱(「Rule Engine」)推導出來的,不是從模組的目錄名稱(`rules/`)—— 而後者才是另外三個 group 實際依循的東西。

**為什麼會發生:** 這三個都是「當一項慣例是關注的明確主題時就能正確套用,但當它只是另一項任務的附帶事項時就漏掉」的例子。bilingual-docs 規則在 observability 變更的*封存*步驟裡被一絲不苟地遵循 —— 那項任務的全部目的就是「把這個變更好好收尾」—— 但這個變更的 artifact 是在主動*起草*期間建立的,當下的注意力都在把技術內容寫對,而 bilingual 這個要求沒有被當成一個獨立、後續的步驟重新檢查。`.env.example` 的缺口之所以發生,是因為登記表 sweep 任務(4.2)的範圍是靠*記憶哪些檔案通常需要更新*來界定的,不是靠系統性地搜尋每一個符合正在更新的那個樣式的檔案 —— 命中三個就感覺像是掃過一輪了。命名的缺口之所以發生,是因為替新東西命名時,會從你腦中已經有的詞彙庫去拿(你正在打造的功能,「Rule Engine」),而不是從「慣例文件說這個樣式是什麼」的 checklist 去拿 —— 尤其是當,不像既有的三個 consumer,模組的目錄名稱跟功能的產品名稱並不相同的時候(`rules/` vs. 「Rule Engine」)。

**如何避免:** 在一個 session 裡正確套用過一次慣例,不代表它會在下一個 artifact 上再次被套用 —— 每一個新的 artifact 都需要對照慣例做自己獨立的明確檢查,而不是因為附近做對了就繼承來的信心。具體來說:(1)bilingual docs —— 把「新的 openspec change:建立 zh-TW 對照版」當成一項在 *artifact 建立時*就要做的任務,而不是封存時;(2)登記表 sweep —— 對整個 repo 搜尋樣式(針對手足環境變數 `grep` 整個 repo),而不是回想哪些檔案「通常」需要它;(3)命名 —— 在替任何受慣例文件規範的東西命名之前,重新讀一次慣例文件的字面樣式,把它套用到模組/目錄的身分上,而不是功能的產品名稱,尤其是當兩者不一致的時候。

---

## Pattern 5:一份權威文件的預測,在讓它成真的變更上線之後,沒有被標記為已實現

**問題:** `docs/design/machine-schema.md` §5.4 記錄了分類重複的問題,並直接點名了它的修法:「Phase 2 的 Rule Engine 應該……〔做這件事〕。」`add-rule-engine` 自己的 `design.md` 跟好幾處原始碼註解都明確引用 §5.4 作為它們的動機背景。這個變更上線了 —— Rule Engine 現在存在了,§5.4 點名為過渡期緩解措施的契約測試也刪除了 —— 但 §5.4 本身從來沒有被重新檢視,所以它繼續描述一個到 code-review 這一輪時其實已經不存在的、還沒解決的問題,以及一個已經不存在的安全網。

**為什麼會發生:** `machine-schema.md` 在起草這個變更時被反覆*引用*(proposal、design doc,以及 Rule Engine 自己的原始碼註解裡都引用了它),但從來沒有被*回頭更新*—— 每一次引用都把它當成可以拉取上下文的來源,而不是一份帶著自己的主張、會被這個變更的完成證偽的文件。這份文件自己的狀態沒有像 `tasks.md` 或 specs 那樣被當成這個變更裡的一個關係人來追蹤。

**如何避免:** 當一份 design doc 或 proposal 明確點名一份既有文件是「這個變更要解決的問題」時,那份既有文件就不只是背景閱讀材料 —— 它在這個變更的完成度上有份利害關係,一旦變更上線,就需要跟 spec 的 requirement 一樣得到自己的更新。在結束一個變更之前,對你自己的 proposal/design 引用為「問題」或「原因」的每一份文件做一次 grep,並檢查它們的主張在這個變更存在之後是否依然準確。

---

## Pattern 6:一個設計決策的好處被描述得比它的成本更嚴謹

**問題:** `design.md` 的決策章節清楚解釋了*為什麼*在 Rule Engine 裡只計算一次分類,會比兩個獨立推導更好。它沒有量化的是:對一個 `TEMPERATURE_REPORTED` 事件來說,針對一台機台文件的 MongoDB 讀取總次數,在這個變更前後都維持在 2 次不變(Rule Engine 新的 `findRaw` 查詢取代的是 Alert Service 舊的查詢,不是消除它;Machine Service 自己的 `findOne` 從來沒被動過)—— 而 Machine/Alert Service 的處理,原本是兩個獨立 consumer group 直接訂閱原始 topic、彼此並行的,現在卻被串接在 Rule Engine 自己的消費-分類-發布步驟後面。這兩個主張都不是假的或被隱藏的 —— 兩者都可以直接從讀 diff 推導出來 —— 但直到 code review 直接問了這個問題之前,design doc 自己的風險章節裡都沒有寫出來。

**為什麼會發生:** 好處(「一個地方計算分類,而不是兩個」)是一個定性的、結構性的主張,可以自信地陳述而不需要測量。成本(I/O 次數、平行度)是一個定量的主張,需要真的去數舊呼叫圖跟新呼叫圖上的操作次數 —— 這是一種不同、更費工的分析,而風險章節既有的條列項目(延遲、契約測試退役、未來可擴展性)剛好都沒有促使去做這件事。

**如何避免:** 當一份 design doc 的決策章節提出一個結構性改善的主張(「只算一次而不是兩次」、「一個真實來源而不是兩個」)時,風險章節應該包含對應的定量檢查:數一數關鍵路徑上實際的操作次數(DB 讀取、網路 hop、鎖的取得)在前後的變化,而不只是數*邏輯住在幾個地方*。即使某個軸向的數字不利,這個設計仍然可能是正確的選擇(在這個專案的 demo 規模下確實如此)—— 重點不是要擋下這個決策,而是要確保這個取捨在被接受之前真的有被看見。
