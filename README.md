# health-check-in-web-app

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-qhc2nuvh)

## AI 助理（本地 Assistant API）

前端透過 Vite 將 `/api` 轉發到本機 Node 服務；**OpenAI 金鑰只放在後端**，請勿使用 `VITE_` 前綴寫進前端。

### 正確啟動方式

1. 在專案根目錄（與 `package.json` 同層）建立 `.env`：可複製 `.env.example` 為 `.env`，並填入 `OPENAI_API_KEY=`。
2. 安裝依賴：`npm install`
3. 同時啟動前端與助理 API：`npm run dev`  
   - 終端應看到 **`[assistant-api] http://127.0.0.1:8788`** 以及 `OPENAI_API_KEY: set`（若為 `missing` 代表金鑰未載入）。  
   - 另會顯示專案根路徑與 `.env` 檔是否存在，方便確認檔案位置是否正確。
4. 瀏覽器開發網址以 Vite 輸出為準（通常為 `http://localhost:5173`）。

### 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | **建議**：用 `concurrently` 同時跑 `dev:server`（助理 API）與 `dev:client`（Vite）。 |
| `npm run dev:server` | 只跑助理 API（埠預設 `8788`）。 |
| `npm run dev:client` | 只跑前端；**此時 AI 無法用**，除非你已另開 API 且 Vite 的 `ASSISTANT_SERVER_URL` 指對位址。 |
| `npm run verify:assistant` | 在 API 已啟動時測試 `GET /api/assistant/health`（預設連 `127.0.0.1:8788`）。 |

### `.env` 位置

- 必須在**專案根目錄**（`package.json` 旁邊），路徑為 `專案根/.env`；可選 `專案根/.env.local`（會覆寫同名變數）。
- 後端由 `server/index.mjs` 透過 `dotenv` 從該根目錄載入，**不要**放在 `src/` 底下。

### 常見問題

- 改過 `.env` 後請**重啟** `npm run dev`（或至少重啟 `dev:server`）。  
- 若只執行 `vite` 或只跑 `dev:client`，代理沒有後端目標，AI 會失敗。  
- 埠號需與 `vite.config.ts` 的 `ASSISTANT_SERVER_URL`（預設 `http://127.0.0.1:8788`）及 `.env` 的 `ASSISTANT_SERVER_PORT` 一致。

### 部署到 Vercel（線上 AI）

靜態前端**不會**讀到你在 Vercel 設的變數，也**沒有**本機的 `127.0.0.1:8788`。專案已在根目錄提供 **Serverless API**（`api/assistant/*`），與 `server/` 共用同一套邏輯。

1. 在 Vercel → **Settings → Environment Variables** 新增 **`OPENAI_API_KEY`**（名稱須完全一致，**不要**加 `VITE_`），並勾選 **Production**（Preview 若要測也請一併勾選）。
2. 儲存後到 **Deployments → Redeploy**（加變數後一定要重新部署，舊 build 不會帶入新變數）。
3. 部署完成後用瀏覽器開：`https://你的網域/api/assistant/health` 應回 JSON，且含 `"openaiReady": true`（金鑰有進函式時）。
4. 可選：`OPENAI_MODEL`（預設 `gpt-4o-mini`）、`AI_PRO_CLIENT_IDS` 等（與 `.env.example` 相同語意）。

**說明：** 每日配額／分鐘頻率在 Vercel 上為無狀態程序，僅能作為參考；若需嚴格計次，之後可改接 KV／資料庫。
