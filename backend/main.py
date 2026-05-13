from fastapi import FastAPI
from pydantic import BaseModel
import sqlite3
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi.responses import FileResponse 
import pandas as pd
import uuid  # 引入 UUID 庫

app = FastAPI()

# 解決跨域問題，讓前端網頁可以呼叫 API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化資料庫
def init_db():
    conn = sqlite3.connect('inspection.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS results (
            id TEXT PRIMARY KEY,
            marker_id INTEGER,
            status TEXT,
            update_time TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class InspectionData(BaseModel):
    marker_id: int
    status: str

@app.get("/results")
def get_results():
    conn = sqlite3.connect('inspection.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, status, update_time, marker_id FROM results")
    data = cursor.fetchall()
    conn.close()
    return {item[0]: {"status": item[1], "time": item[2], "marker_id": item[3]} for item in data}

@app.post("/update")
def update_result(data: InspectionData):
    conn = sqlite3.connect('inspection.db')
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    new_uuid = str(uuid.uuid4())

    cursor.execute('''
        INSERT INTO results (id, marker_id, status, update_time)
        VALUES (?, ?, ? , ?)
    ''', (new_uuid, data.marker_id, data.status, now))
    conn.commit()
    conn.close()
    return {"message": "Success", "id": new_uuid, "time": now}

@app.get("/export")
def export_report():
    # 這裡可以呼叫上面的邏輯產生 Excel 檔案
    # 假設產生的檔名為 latest_report.xlsx
    # 您也可以直接在 API 內動態產生並回傳
    
    db_path = "inspection.db"
    if not os.path.exists(db_path):
        return {"error": "檔案尚未產生，請先進行點檢"}
        # return FileResponse(path=file_path, filename="點檢紀錄.xlsx", media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    
    try:
        conn  = sqlite3.connect(db_path)
        df = pd.read_sql_query("SELECT * FROM results", conn)
        conn.close()

        if df.empty:
            return {"error": "目前資料庫尚為記錄"}
        
        # 1. 產生動態檔名（這會決定瀏覽器下載時看到的名稱）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        download_filename = f"設備點檢紀錄_{timestamp}.xlsx"
        
        temp_file_path = "temp_report.xlsx"

        # 選擇性：重新命名欄位讓 Excel 報表更易讀
        df.columns = ['紀錄唯一碼 (UUID)', '設備 ID', '點檢狀態', '更新時間']
        
        df.to_excel(temp_file_path, index=False)

        return FileResponse(
            path = temp_file_path,
            filename=download_filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    
    except Exception as e:
        return {"error": f"產生報表失敗: {str(e)}"}



