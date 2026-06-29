# Intelligent-Factory-Operations-Copilot 智慧製造營運助理系統
Intelligent Factory Operations Copilot is a production-style system that combines event-driven architecture, rule-based anomaly detection, RAG, and workflow automation to help engineers investigate manufacturing incidents.

## Roadmap

See `docs/product-roadmap.md`


docs/
│
├── README.md                           # 文件導覽（Documentation Index）
│
├── product/                            # Product Documentation
│   ├── product-roadmap.md              # Long-term product roadmap
│   └── mvp.md                          # Minimum Viable Product scope
│
├── design/                             # System Design
│   ├── architecture.md                 # Overall system architecture
│   ├── event-flow.md                   # Event processing flow
│   ├── machine-schema.md               # Machine domain model
│   ├── event-schema.md                 # Event domain model
│   ├── api.md                          # API contract
│   ├── database.md                     # (Future) Database design
│   ├── ai-design.md                    # (Future) AI architecture
│   └── security.md                     # (Future) Security design
│
├── decisions/                          # Architecture Decision Records (ADR)
│   ├── README.md                       # ADR guideline
│   ├── ADR-0001-use-kafka.md
│   ├── ADR-0002-use-mongodb.md
│   ├── ADR-0003-rest-api.md
│   └── ADR-0004-ai-summary-before-rag.md
│
├── deployment/                         # Deployment Documentation
│   ├── local-development.md
│   ├── docker-compose.md
│   └── kubernetes.md
│
└── assets/                             # Images & diagrams
    ├── architecture.drawio
    ├── event-flow.drawio
    ├── system-overview.png
    └── screenshots/

