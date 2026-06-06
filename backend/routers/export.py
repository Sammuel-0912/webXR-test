"""報表匯出 API。路由路徑與回傳格式與原 main.py 完全一致。"""

import os
import sqlite3
from datetime import datetime

import pandas as pd
from fastapi import APIRouter
from fastapi.responses import FileResponse

from db import DB_PATH

router = APIRouter(tags=["export"])


@router.get("/export")
def export_report():
    db_path = DB_PATH
    if not os.path.exists(db_path):
        return {"error": "Database not found."}
    try:
        with sqlite3.connect(db_path) as conn:
            df = pd.read_sql_query(
                "SELECT r.id, r.marker_id, COALESCE(d.name, 'Unknown') AS device_name, "
                "r.status, r.update_time "
                "FROM results r LEFT JOIN devices d ON r.marker_id = d.marker_id "
                "ORDER BY r.update_time DESC",
                conn,
            )
        if df.empty:
            return {"error": "No records found."}
        df.columns = ["UUID", "Marker ID", "Device Name", "Status", "Time"]
        timestamp     = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_file_path = "temp_report.xlsx"
        df.to_excel(temp_file_path, index=False)
        return FileResponse(
            path=temp_file_path,
            filename="inspection_report_" + timestamp + ".xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        return {"error": "Export failed: " + str(e)}
