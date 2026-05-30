# 前端 — AR 設備點檢系統

React 19 + Vite 8 + Bootstrap 5.3 的單頁應用（SPA）。完整專案說明見 [根目錄 README](../README.md)。

## 開發

```bash
npm install
cp .env.example .env   # 視需要填入後端網址
npm run dev            # http://localhost:5173
```

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器（HMR） |
| `npm run build` | 打包到 `dist/` |
| `npm run preview` | 預覽打包結果 |
| `npm run lint` | ESLint |

## 環境變數

於本目錄的 `.env`（可由 `.env.example` 複製）設定：

```
VITE_BACKEND_URL=http://192.168.1.100:8000
```

build 時注入；留空時自動 fallback 至「目前 hostname:8000」。

## 頁面

| 路由 | 檔案 | 說明 |
|---|---|---|
| `/dashboard` | [src/pages/DashboardPage.jsx](src/pages/DashboardPage.jsx) | 良率總覽、紀錄查詢、報表匯出 |
| `/devices` | [src/pages/DeviceManagePage.jsx](src/pages/DeviceManagePage.jsx) | 設備 CRUD、AR Marker、列印點檢卡 |
| `/ar-inspect` | [src/pages/ArInspectPage.jsx](src/pages/ArInspectPage.jsx) | A-Frame + AR.js AR 點檢 |

## 樣式架構（OOCSS）

- Bootstrap utility 優先；版面、卡片、表格、表單、Modal 皆用內建 class。
- [src/index.css](src/index.css)：主題 tokens（深色覆寫 Bootstrap 變數）。
- [src/App.css](src/App.css)：Bootstrap 沒有的自訂物件（AR 疊層、bottom sheet、狀態徽章等），結構與皮膚分離。
- 主題切換見 [src/components/ThemeToggle.jsx](src/components/ThemeToggle.jsx)。

## AR Marker

`public/markers/3x3/0.png`–`63.png` 為 AR.js 3×3 barcode marker，對應設備 `marker_id`。詳見根目錄 README。
