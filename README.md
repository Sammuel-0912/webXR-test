# AR 設備點檢系統

以 **AR（擴增實境）** 進行設備巡檢的全端應用。現場人員用手機鏡頭對準貼在設備上的 AR Marker，即可叫出該設備的作業指引並回報點檢結果（正常 / 異常）；管理端則提供設備管理、良率統計、紀錄查詢與報表匯出。

---

## ✨ 功能特色

- **AR 點檢**：A-Frame + AR.js，掃描 3×3 barcode marker 即時辨識設備，顯示作業指引與設備圖，一鍵回報 OK / WARN。
- **QR 掃碼捷徑**：每台設備可產生帶 `marker_id` 的連結，手機掃描後直接進入該設備的點檢畫面（`qrMode`）。
- **設備管理**：新增 / 編輯 / 刪除設備、上傳作業指引圖、顯示與下載對應的 AR Marker、列印「設備點檢卡」。
- **儀表板**：各設備良率總覽（色階卡片）、點檢紀錄表（可依設備 / 時間區間篩選）、Excel 報表匯出。
- **RWD + 亮/暗主題**：Bootstrap 5.3，深色為主、可切換亮色，手機到桌機自適應。
- **資料持久化**：DB 與上傳圖片集中於 `DATA_DIR`，方便雲端掛載單一 volume，重部署不遺失資料。

---

## 🧱 技術棧

| 層 | 技術 |
|---|---|
| 前端 | React 19、Vite 8、React Router 7、Bootstrap 5.3 |
| AR | A-Frame 1.3.0 + AR.js 3.4.5（執行時由 CDN 載入） |
| 後端 | FastAPI、Uvicorn、SQLite |
| 報表 | pandas + openpyxl |
| 其他 | Pillow、python-multipart |

---

## 📁 目錄結構

```
webXR-test/
├── backend/                    # FastAPI 後端
│   ├── main.py                 # API 主程式（裝置 CRUD / 點檢 / 統計 / 匯出）
│   ├── admin.py                # 獨立的 Excel 匯出腳本（手動執行）
│   ├── data/                   # 持久化資料（執行時建立，不進版控）
│   │   ├── inspection.db       #   SQLite 資料庫
│   │   └── uploads/            #   設備作業指引圖
│   ├── Procfile                # 部署啟動指令
│   ├── pyproject.toml / uv.lock
│   └── requirements.txt
│
└── frontend-project/           # React 前端
    ├── src/
    │   ├── pages/
    │   │   ├── DashboardPage.jsx     # 儀表板（良率、紀錄、匯出）
    │   │   ├── DeviceManagePage.jsx  # 設備管理（CRUD、AR Marker、列印）
    │   │   └── ArInspectPage.jsx     # AR 點檢（A-Frame + AR.js）
    │   ├── components/ThemeToggle.jsx # 亮/暗主題切換
    │   ├── index.css            # 主題 tokens（OOCSS skin 層）
    │   └── App.css              # 自訂 OOCSS 物件層（AR 疊層等）
    └── public/
        ├── markers/3x3/         # AR.js 3×3 barcode marker 圖（0–63）
        └── _redirects           # SPA fallback
```

---

## 🚀 快速開始

需求：**Node.js 20+**（Vite 8）、**Python 3.13**。前後端需分別啟動。

### 1. 後端（埠 8000）

```bash
cd backend

# 方式 A：使用 uv（專案附 uv.lock）
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 方式 B：使用 pip
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

啟動後：API 文件 `http://localhost:8000/docs`。首次啟動會自動建立 `data/inspection.db` 並寫入 3 筆預設設備。

### 2. 前端（埠 5173）

```bash
cd frontend-project
npm install
npm run dev
```

開啟 `http://localhost:5173`，預設導向 `/dashboard`。

其他指令：`npm run build`（打包）、`npm run preview`（預覽打包結果）、`npm run lint`。

---

## ⚙️ 環境變數

| 變數 | 位置 | 預設 | 說明 |
|---|---|---|---|
| `VITE_BACKEND_URL` | 前端（build 時注入） | 同 hostname 的 `:8000` | 後端 API 位址 |
| `DATA_DIR` | 後端 | `data` | DB 與上傳圖片的存放目錄（雲端掛 volume 用） |

前端本機開發可在 `frontend-project/` 建立 `.env`：

```
VITE_BACKEND_URL=http://192.168.1.100:8000
```

> 💡 後端 API 位址也可在「設備管理」頁面的「後端 API 連線設定」即時調整（存於該頁 state）。

---

## 🎯 AR Marker 說明

- AR 偵測使用 **AR.js 3×3 barcode marker**（`matrixCodeType:3x3`），有效值 **0–63**，對應設備的 `marker_id`。
- 標記圖放在 [frontend-project/public/markers/3x3/](frontend-project/public/markers/3x3/)（`0.png`–`63.png`），來源為 [artoolkit-barcode-markers-collection](https://github.com/nicolocarpignoli/artoolkit-barcode-markers-collection)。
- 在「設備管理」頁可下載 / 列印對應的 Marker，印出後貼於設備上即可被相機辨識。
- ⚠️ 相機存取需要 **安全環境（HTTPS 或 localhost）**。手機在區網以 `http://` 開啟 AR 頁會無法取得鏡頭，正式環境請走 HTTPS（Zeabur 預設提供）。

---

## 🔌 API 端點

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/devices` | 列出所有設備 |
| POST | `/devices` | 新增設備（`marker_id` 重複回 409） |
| PATCH | `/devices/{marker_id}` | 更新設備欄位 |
| DELETE | `/devices/{marker_id}` | 刪除設備 |
| POST | `/devices/{marker_id}/image` | 上傳設備圖（multipart `file`） |
| POST | `/update` | 送出點檢結果（`{marker_id, status: ok\|warn}`） |
| GET | `/results` | 查詢紀錄，支援 `?marker_id=&start=&end=` |
| DELETE | `/results/{record_id}` | 刪除單筆紀錄 |
| GET | `/stats` | 各設備良率統計 |
| GET | `/stats/{marker_id}` | 單一設備統計 |
| GET | `/export` | 匯出全部紀錄為 Excel |
| GET | `/uploads/{file}` | 設備圖片靜態服務 |

完整 schema 見 `http://localhost:8000/docs`。

---

## 🗄️ 資料庫 Schema（SQLite）

```sql
-- 點檢紀錄
results (
  id          TEXT PRIMARY KEY,   -- UUID
  marker_id   INTEGER,
  status      TEXT,               -- 'ok' | 'warn'
  update_time TEXT                -- ISO 時間字串
)

-- 設備
devices (
  marker_id        INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  created_at       TEXT NOT NULL,
  work_instruction TEXT,          -- 作業指引
  image_url        TEXT           -- '/uploads/xxx'
)
```

---

## ☁️ 部署（Zeabur）

**後端**
1. 服務 Root 設為 `backend/`（Procfile：`uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`）。
2. 新增 **Volume**，Mount Path 設為 `/app/data`（必要時加環境變數 `DATA_DIR=/app/data`）。
3. 之後重部署，DB 與上傳圖片都保留在 volume。

**前端**
1. 服務 Root 設為 `frontend-project/`，Build：`npm run build`，輸出 `dist/`。
2. 設定環境變數 `VITE_BACKEND_URL` 指向後端公開網址（build 時注入）。
3. SPA 路由由 [public/_redirects](frontend-project/public/_redirects)（`/* /index.html 200`）處理。

---

## 📝 操作流程

1. **設備管理**：新增設備並指定 `marker_id`（0–63），上傳作業指引圖，列印 / 下載 AR Marker 貼到設備上。
2. **現場點檢**：開啟 `/ar-inspect` →「開始 AR 掃描」→ 鏡頭對準 Marker → 看作業指引 → 按「正常 OK」或「異常 WARN」。
   （或手機掃描設備頁產生的 QR 連結直接進入單一設備點檢。）
3. **儀表板**：查看良率、用設備 / 時間篩選紀錄、匯出 Excel 報表。

---

## ℹ️ 備註

- 後端 CORS 目前為 `allow_origins=["*"]`，正式環境建議收斂為前端網域。
- `backend/admin.py` 為可獨立執行的報表匯出腳本，與 API 服務分離。
- `frontend-project/public/ar-inspect.html` 為早期的純靜態 AR 頁，現行 AR 功能已改用 React 的 `/ar-inspect` 路由。
