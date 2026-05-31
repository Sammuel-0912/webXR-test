# 開發規範（CLAUDE.md）

本檔記錄此專案的開發原則，所有人（含 AI 協作）都必須遵守。

## 1. 避免硬編碼（No Hardcoding）

- 不要把會變動的值寫死在程式裡。後端位址、port、CORS 來源、逾時時間、白名單等一律抽出。
- **環境相關設定**走環境變數，並提供安全的預設值（不設定也能照舊運作）：
  - 前端：`VITE_BACKEND_URL`、`VITE_BACKEND_PORT`，統一由 [frontend-project/src/config.js](frontend-project/src/config.js) 的 `resolveBackendUrl()` 解析，**禁止**在頁面各自寫 `http://localhost:8000`。
  - 後端：`DATA_DIR`、`DB_PATH`、`UPLOAD_DIR`、`CORS_ORIGINS`，見 [backend/main.py](backend/main.py)。
- **魔術數字 / 字串**抽成具名常數，放在檔案頂部（例如 `REQUEST_TIMEOUT_MS`、`ALLOWED_IMAGE_EXTENSIONS`）。
- 例外：領域參數（AR 3D 座標、scale、`matrixCodeType:3x3`、顏色配置）屬於有意義的設定值，可保留在原處，但要清楚命名。

## 2. 使用框架，不自造輪子（Use Frameworks）

- **樣式**：一律用 Bootstrap 5（utility-first），搭配 OOCSS（結構與外觀分離）讓樣式可重用；自訂樣式只放在 object/skin 層，不重寫框架已有的功能。
- **RWD**：用 Bootstrap 的 grid / breakpoint 達成自適應，不手刻 media query。
- **主題**：用 `data-bs-theme` 切換深淺色。
- **前端**：React 19 + Vite + React Router。**後端**：FastAPI。**套件管理**：前端用 **pnpm**（非 npm）。
- 第三方資源優先 `npm/pnpm install` 到本地，透過 Vite `?url` import，**不**依賴 CDN（避免弱網載入慢、離線失效）。

## 3. 分支與發版流程（Branching & PR）

開發任何**新需求**前，先從 `main` 開新分支，**不直接在 `main` 上開發**。

1. 建立分支並命名為 `{feature}_{目前時間}`
   - `{feature}`：用簡短英文描述功能（kebab-case），例如 `cors-config`。
   - `{目前時間}`：時間戳，格式 `YYYYMMDD-HHmm`，例如 `20260531-1430`。
   - 範例：`git switch -c cors-config_20260531-1430`
2. 在該分支上開發、提交。
3. **本機測試全部通過**後（見下方檢查清單），才由我（使用者）親自發 PR 合併回 `main`。
   - AI 協作者**不得自行 commit 或 push**，除非使用者明確要求。

### 合併前必過的測試
- 前端：`pnpm build`（EXIT=0，無建置錯誤）。
- 後端：`python -m py_compile`（或對應測試）通過。
- 確認無殘留硬編碼、無新的 lint 錯誤。

## 4. 協作慣例（AI Collaboration）

- 動手改檔前先確認環境 / 讀取現況，不要在未驗證的情況下搶先修改。
- 改完要實際驗證（build / compile / grep），並如實回報結果（含失敗）。
- 溝通一律用**繁體中文**。
