"""應用組裝層:建立 FastAPI app、CORS、掛載靜態檔、初始化 DB、註冊路由。

實際邏輯已拆分至:
- db.py            資料層（路徑/連線/init_db）
- models.py        Pydantic schema
- routers/devices.py      設備管理 API
- routers/inspections.py  點檢結果與統計 API
- routers/export.py       報表匯出 API
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db import UPLOAD_DIR, init_db
from routers import devices, export, inspections

app = FastAPI()

# CORS 來源:預設 "*"（維持原行為）;正式環境可用環境變數 CORS_ORIGINS
# 指定白名單（逗號分隔）,例:CORS_ORIGINS="https://app.example.com,https://admin.example.com"
_cors_env = os.environ.get("CORS_ORIGINS", "*").strip()
CORS_ORIGINS = ["*"] if _cors_env == "*" else [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],  # 讓瀏覽器端能讀取分頁總數 header
)

# 對外 URL 維持 /uploads/...,前端與 DB 既有資料不受影響。
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# 啟動時初始化資料表與預設設備。
init_db()

# 註冊路由（路徑與原 main.py 完全一致,前端無需調整）。
app.include_router(devices.router)
app.include_router(inspections.router)
app.include_router(export.router)
