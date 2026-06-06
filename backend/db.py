"""資料層:持久化路徑、上傳設定、DB 初始化與連線。

設計原則（見 CLAUDE.md）:
- 不硬編碼會變動的值,環境相關設定走環境變數並提供安全預設值。
- 集中管理路徑與常數,供各 router 共用,避免散落重複。
"""

import os
import sqlite3
from datetime import datetime

# --- Persistent data directory ---
# DB 與上傳圖片都放在 DATA_DIR,方便在 Zeabur 掛載「單一 volume」,避免重部署後資料遺失。
# 預設 "data"（相對於後端工作目錄,部署時即容器內的 /app/data）;
# 可用環境變數 DATA_DIR 覆寫成 volume 掛載的絕對路徑。
DATA_DIR = os.environ.get("DATA_DIR", "data")
os.makedirs(DATA_DIR, exist_ok=True)

# DB 路徑（可用環境變數 DB_PATH 覆寫；預設置於 DATA_DIR 下）。
DB_PATH = os.environ.get("DB_PATH", os.path.join(DATA_DIR, "inspection.db"))

# --- Uploads directory ---
# 實體目錄移到 DATA_DIR 下（一併持久化）;對外 URL 仍維持 /uploads/...,前端與 DB 既有資料不受影響。
# 可用環境變數 UPLOAD_DIR 覆寫。
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(DATA_DIR, "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 允許上傳的圖片副檔名（集中管理,供 upload 端點驗證）
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def connect():
    """取得一個 SQLite 連線。呼叫端以 `with connect() as conn:` 使用,離開時自動 commit。"""
    return sqlite3.connect(DB_PATH)


# --- Default devices ---

_DEFAULT_DEVICES = [
    {"marker_id": 0, "name": "INPUT 輸入端",    "description": "UPS INPUT",
     "work_instruction": "1. 確認輸入電壓正常 (220V±10%)\n2. 檢查電纜接頭無鬆脫\n3. 確認指示燈為綠色"},
    {"marker_id": 1, "name": "OUTPUT 輸出端",  "description": "UPS OUTPUT",
     "work_instruction": "1. 確認輸出電壓穩定 (220V)\n2. 量測輸出電流不超過額定值\n3. 檢查負載連接狀況"},
    {"marker_id": 2, "name": "BATTERY 電池組", "description": "UPS BATTERY",
     "work_instruction": "1. 確認電池電壓 ≥ 48V\n2. 觀察電池溫度無異常發熱\n3. 確認充電指示燈正常"},
]


def init_db():
    """建立資料表（若不存在）、補欄位（migration）、寫入預設設備。"""
    with connect() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS results "
            "(id TEXT PRIMARY KEY, marker_id INTEGER, status TEXT, update_time TEXT)"
        )
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS devices "
            "(marker_id INTEGER PRIMARY KEY, name TEXT NOT NULL, "
            "description TEXT, created_at TEXT NOT NULL)"
        )
        # 索引:results 常以 marker_id 篩選、以 update_time 排序/範圍查詢,建立索引避免全表掃描。
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_results_marker_id ON results(marker_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_results_update_time ON results(update_time)")

        # Migration: add new columns if missing
        existing = {row[1] for row in cursor.execute("PRAGMA table_info(devices)")}
        if "work_instruction" not in existing:
            cursor.execute("ALTER TABLE devices ADD COLUMN work_instruction TEXT")
        if "image_url" not in existing:
            cursor.execute("ALTER TABLE devices ADD COLUMN image_url TEXT")

        for d in _DEFAULT_DEVICES:
            cursor.execute(
                "INSERT OR IGNORE INTO devices "
                "(marker_id, name, description, created_at, work_instruction, image_url) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (d["marker_id"], d["name"], d["description"],
                 datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                 d.get("work_instruction"), d.get("image_url")),
            )
