# 架構決策紀錄（ADR）

本資料夾存放 ADR — 針對重大技術決策的簡短紀錄：做了什麼決策、為什麼、以及否決了哪些替代方案。

ADR 不是設計規格。它不描述某個東西*如何*運作（那屬於 `docs/design/`）。它記錄*為什麼*做了某個選擇，讓半年後的人不必猜測某個限制是刻意的還是偶然的。

---

## 什麼時候寫

當一個決策符合以下條件時，寫一份 ADR：

* 之後很難或代價很高才能逆轉。
* 影響多個模組或整個系統，而不只是單一檔案。
* 有真正被認真評估過又被否決的替代方案。
* 之後很可能被質疑（「為什麼我們不直接用 X？」）。

不要為以下決策寫 ADR：容易改變的、純粹侷限於單一模組的、或沒有值得記錄的真正替代方案的。

## 格式

每份 ADR 是一個名為 `ADR-NNNN-short-title.md` 的檔案，依序編號；即使某份 ADR 之後被取代，編號也絕不重編或重用。

```markdown
# ADR-NNNN: Title

## Status
Proposed | Accepted | Superseded by ADR-XXXX

## Context
What problem or constraint led to this decision? What forces were in tension?

## Decision
What was decided, stated as a plain sentence.

## Consequences
What this makes easier, what it makes harder, and what it costs.

## Alternatives Considered
What else was evaluated, and why it was not chosen.
```

## 索引

| ADR | 決策 |
| --- | --- |
| [ADR-0001](ADR-0001-use-kafka.md) | 使用 Kafka 作為事件骨幹 |
| [ADR-0002](ADR-0002-use-mongodb.md) | 使用 MongoDB 存放事件與投影 |
| [ADR-0003](ADR-0003-rest-api.md) | MVP API 選用 REST 而非 GraphQL/gRPC |
| [ADR-0004](ADR-0004-ai-summary-before-rag.md) | 直接 LLM 摘要先於 RAG 交付 |

本索引應與 `docs/design/architecture.md` §18（Architecture Decisions / ADR Summary）保持同步，後者是同一份內容每個決策一行的濃縮版。
