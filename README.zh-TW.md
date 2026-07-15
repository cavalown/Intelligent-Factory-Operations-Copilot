# Intelligent Factory Operations Copilot 智慧製造營運助理系統

Intelligent Factory Operations Copilot（智慧工廠營運助理）是一套仿正式生產環境（production-style）的系統，結合事件驅動架構（event-driven architecture）、規則式異常偵測（rule-based anomaly detection）、RAG 與工作流程自動化，協助工程師調查製造事故。

[English version](README.md)

## 技術棧

| 層級 | 技術 |
| --- | --- |
| 前端 | Vue 3, TypeScript |
| 後端 | NestJS（模組化單體架構） |
| 訊息傳遞 | Kafka（主題：`machine.events`，key：`machineId`） |
| 資料庫 | MongoDB |
| AI | LLM API（直接產生摘要；RAG 規劃中） |
| 可觀測性 | OpenTelemetry → Grafana LGTM stack |
| 本地執行環境 | Docker Compose |

## 快速開始

```bash
docker compose up
```

| 服務 | URL |
| --- | --- |
| 前端 | http://localhost:5173 |
| 後端 API | http://localhost:3000/api |
| Grafana（可觀測性） | http://localhost:3001 |

服務細節與環境變數請見 [`docs/deployment/docker-compose.md`](docs/deployment/docker-compose.md)；若要在 Docker 之外執行服務，請見 [`docs/deployment/local-development.md`](docs/deployment/local-development.md)。

## 專案結構

| 路徑 | 內容 |
| --- | --- |
| [`backend/`](backend/) | NestJS API — 事件消費者、機台／告警投影、AI 摘要服務 |
| [`frontend/`](frontend/) | Vue 3 儀表板 |
| [`docs/`](docs/README.zh-TW.md) | 產品、設計與部署文件 |
| [`ai/`](ai/README.md) | 供 AI 程式協作工具使用的專案脈絡、規則與工作流程 |
| [`openspec/`](openspec) | 規格驅動的變更提案 |

## 文件

從 [`docs/README.zh-TW.md`](docs/README.zh-TW.md) 開始——完整的文件索引，附建議閱讀順序。重點文件：

* [`docs/product/mvp.zh-TW.md`](docs/product/mvp.zh-TW.md) — MVP 的範圍與目的
* [`docs/design/architecture.zh-TW.md`](docs/design/architecture.zh-TW.md) — 系統架構
* [`docs/product/product-roadmap.zh-TW.md`](docs/product/product-roadmap.zh-TW.md) — 長期產品路線圖

## 授權

目前尚無授權檔案，預設保留所有權利。
