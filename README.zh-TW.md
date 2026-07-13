# Intelligent-Factory-Operations-Copilot 智慧製造營運助理系統

Intelligent Factory Operations Copilot（智慧工廠營運助理）是一套仿正式生產環境（production-style）的系統，結合事件驅動架構（event-driven architecture）、規則式異常偵測（rule-based anomaly detection）、RAG 與工作流程自動化，協助工程師調查製造事故。

## 產品路線圖

見 `docs/product-roadmap.md`


docs/
│
├── README.md                           # 文件導覽（Documentation Index）
│
├── product/                            # 產品文件
│   ├── product-roadmap.md              # 長期產品路線圖
│   └── mvp.md                          # 最小可行產品（MVP）範圍
│
├── design/                             # 系統設計
│   ├── architecture.md                 # 整體系統架構
│   ├── event-flow.md                   # 事件處理流程
│   ├── machine-schema.md               # 機台領域模型
│   ├── event-schema.md                 # 事件領域模型
│   ├── api.md                          # API 契約
│   ├── database.md                     # （未來）資料庫設計
│   ├── ai-design.md                    # （未來）AI 架構
│   └── security.md                     # （未來）資安設計
│
├── decisions/                          # 架構決策紀錄（ADR）
│   ├── README.md                       # ADR 撰寫指引
│   ├── ADR-0001-use-kafka.md
│   ├── ADR-0002-use-mongodb.md
│   ├── ADR-0003-rest-api.md
│   └── ADR-0004-ai-summary-before-rag.md
│
├── deployment/                         # 部署文件
│   ├── local-development.md
│   ├── docker-compose.md
│   └── kubernetes.md
│
└── assets/                             # 圖片與圖表
    ├── architecture.drawio
    ├── event-flow.drawio
    ├── system-overview.png
    └── screenshots/
