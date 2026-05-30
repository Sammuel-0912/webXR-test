# 後端 — AR 設備點檢系統

FastAPI + SQLite 的 REST API。完整專案說明見 [根目錄 README](../README.md)。

## 開發

```bash
# uv（推薦，附 uv.lock）
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 或 pip
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

需求 Python 3.13。啟動後 API 文件在 `/docs`。首次啟動自動建立 `data/inspection.db` 與 3 筆預設設備。

## 環境變數

| 變數 | 預設 | 說明 |
|---|---|---|
| `DATA_DIR` | `data` | DB 與上傳圖片存放目錄（雲端掛 volume 用） |

## 結構

- [main.py](main.py)：API 主程式（設備 CRUD、點檢、統計、匯出、圖片上傳）。
- [admin.py](admin.py)：可獨立執行的 Excel 匯出腳本（與 API 服務分離）。
- `data/`：執行時建立，含 `inspection.db` 與 `uploads/`，不進版控。

## API 端點

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/devices` | 列出設備 |
| GET | `/devices/{marker_id}` | 取得單一設備 |
| POST | `/devices` | 新增設備（marker_id 重複回 409） |
| PATCH | `/devices/{marker_id}` | 更新設備 |
| DELETE | `/devices/{marker_id}` | 刪除設備 |
| POST | `/devices/{marker_id}/image` | 上傳設備圖 |
| POST | `/update` | 送出點檢結果 |
| GET | `/results` | 查詢紀錄（`?marker_id=&start=&end=`） |
| DELETE | `/results/{record_id}` | 刪除紀錄 |
| GET | `/stats` | 良率統計（可帶 `?marker_id=`） |
| GET | `/export` | 匯出 Excel |

## 部署

Procfile：`web: uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`。
Zeabur 將服務 Root 設為 `backend/`，並掛 Volume 至 `/app/data`。
