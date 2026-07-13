# 本機開發（不使用完整 Docker Compose）

## 1. 目的

`docs/deployment/docker-compose.md` 把 MVP 的四個服務全部跑在容器裡 — 適合乾淨的 demo，但迭代很慢：每次後端或前端程式碼變更都得重新 build。

本文件說明**混合式工作流程**：基礎設施（`kafka`、`mongodb`）留在 Docker，`backend` 與 `frontend` 則直接在主機上原生執行、支援熱重載。一旦 `backend/` 與 `frontend/` 成為實際專案，這就是預期的日常開發設定。

---

## 2. 前置需求

* Docker Desktop（或同等工具）運行中，供 `kafka` 與 `mongodb` 容器使用。
* Node.js（版本待 `backend/package.json` / `frontend/package.json` 存在後釘選 — 見 §5 未定假設）。
* npm（或專案最終選定的套件管理器）。

---

## 3. 步驟一 — 只啟動基礎設施

從既有的 Compose 檔只啟動 `kafka` 與 `mongodb`，略過 `backend` 與 `frontend`：

```bash
docker compose up -d kafka mongodb
```

兩者都可從主機連線：

* MongoDB：`localhost:27017`
* Kafka：`localhost:9093` — 這是 `docker-compose.md` §3 定義的 `PLAINTEXT_HOST` listener，不是 `9092`。埠 `9092` 是容器對容器的 listener，主機上的程序無法正確連線（見 `docker-compose.md` §4）。

---

## 4. 步驟二 — 原生執行後端與前端

### 後端

```bash
cd backend
npm install
npm run start:dev
```

環境變數指向主機曝露的埠，而不是 Docker 網路主機名稱：

```text
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ifoc
KAFKA_BROKERS=localhost:9093
KAFKA_TOPIC_MACHINE_EVENTS=machine.events
LLM_API_KEY=<your key>
```

這與 `docker-compose.md` §5 是同一組變數，只是把 `mongodb`/`kafka`（Docker 網路主機名稱）換成 `localhost` 與對應的主機埠。

### 前端

```bash
cd frontend
npm install
npm run dev
```

```text
VITE_API_BASE_URL=http://localhost:3000/api
```

與容器化設定完全相同 — 無論後端是容器化還是原生執行，前端一律透過 `localhost:3000` 與後端溝通，因為 `docker-compose.md` 的 `backend` 服務同樣把埠 `3000` 發布到主機。

---

## 5. 與完整 Docker Compose 的比較

| | 完整 Docker Compose | 混合式（本文件） |
| --- | --- | --- |
| `kafka`、`mongodb` | 容器 | 容器（與完整設定相同） |
| `backend`、`frontend` | 容器，要看到變更需重新 build | 原生程序，熱重載 |
| 後端使用的 Kafka 位址 | `kafka:9092` | `localhost:9093` |
| 後端使用的 MongoDB 位址 | `mongodb:27017` | `localhost:27017` |
| 適合場景 | Demo、確認容器化 build 可用 | 日常開發 |

---

## 6. 未定假設

1. **Node.js 版本**在 repo 中尚未釘選（還沒有 `.nvmrc` 或 `engines` 欄位，因為 `backend/` 與 `frontend/` 尚不存在）。專案腳手架建立後就釘選。
2. 本文件假設 `backend` 的 `start:dev` 腳本與 `frontend` 的 `dev` 腳本存在，且從環境變數（而非寫死的設定檔）讀取設定 — 這是 NestJS/Vite 的標準做法，但在專案腳手架建立後值得確認。
