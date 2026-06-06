"""點檢結果與統計 API。路由路徑與回傳格式與原 main.py 完全一致。"""

import sqlite3
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response

from db import DB_PATH
from models import InspectionData

router = APIRouter(tags=["inspections"])

# 分頁設定（避免硬編碼魔術數字;前端不帶參數時仍以 DEFAULT_PAGE_SIZE 回傳第一頁）
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE     = 1000


@router.get("/results")
def get_results(
    response:  Response,
    marker_id: Optional[int] = Query(None),
    start:     Optional[str] = Query(None),
    end:       Optional[str] = Query(None),
    limit:     int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset:    int = Query(0, ge=0),
):
    conditions, params = [], []
    if marker_id is not None:
        conditions.append("r.marker_id = ?"); params.append(marker_id)
    if start:
        conditions.append("r.update_time >= ?"); params.append(start)
    if end:
        conditions.append("r.update_time <= ?"); params.append(end)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        # 符合篩選的總筆數（放在 X-Total-Count header,供前端分頁計算）
        cursor.execute("SELECT COUNT(*) FROM results r " + where, params)
        total = cursor.fetchone()[0]

        sql = (
            "SELECT r.id, r.status, r.update_time, r.marker_id, "
            "COALESCE(d.name, 'Unknown') AS device_name "
            "FROM results r LEFT JOIN devices d ON r.marker_id = d.marker_id "
            + where + " ORDER BY r.update_time DESC LIMIT ? OFFSET ?"
        )
        cursor.execute(sql, params + [limit, offset])
        data = cursor.fetchall()

    response.headers["X-Total-Count"] = str(total)
    return {
        item[0]: {"status": item[1], "time": item[2], "marker_id": item[3], "device_name": item[4]}
        for item in data
    }


@router.post("/update")
def update_result(data: InspectionData):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_uuid = str(uuid.uuid4())
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO results (id, marker_id, status, update_time) VALUES (?, ?, ?, ?)",
            (new_uuid, data.marker_id, data.status.value, now),
        )
    return {"message": "Success", "id": new_uuid, "time": now}


@router.delete("/results/{record_id}", status_code=200)
def delete_result(record_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM results WHERE id = ?", [record_id])
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Deleted", "id": record_id}


@router.get("/stats")
def get_stats(marker_id: Optional[int] = Query(None)):
    where  = "WHERE r.marker_id = ?" if marker_id is not None else ""
    params = [marker_id] if marker_id is not None else []
    sql = (
        "SELECT r.marker_id, COALESCE(d.name, 'Unknown') AS device_name, "
        "COUNT(*) AS total, "
        "SUM(CASE WHEN r.status = 'ok'   THEN 1 ELSE 0 END) AS ok_count, "
        "SUM(CASE WHEN r.status = 'warn' THEN 1 ELSE 0 END) AS warn_count "
        "FROM results r LEFT JOIN devices d ON r.marker_id = d.marker_id "
        + where + " GROUP BY r.marker_id ORDER BY r.marker_id"
    )
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
    return [
        {
            "marker_id":   m, "device_name": dn, "total": t,
            "ok_count": ok, "warn_count": wn,
            "ok_rate": round(ok / t, 4) if t else 0,
        }
        for m, dn, t, ok, wn in rows
    ]


@router.get("/stats/{marker_id}")
def get_stats_by_device(marker_id: int):
    sql = (
        "SELECT r.marker_id, COALESCE(d.name, 'Unknown') AS device_name, "
        "COUNT(*) AS total, "
        "SUM(CASE WHEN r.status = 'ok'   THEN 1 ELSE 0 END) AS ok_count, "
        "SUM(CASE WHEN r.status = 'warn' THEN 1 ELSE 0 END) AS warn_count "
        "FROM results r LEFT JOIN devices d ON r.marker_id = d.marker_id "
        "WHERE r.marker_id = ? GROUP BY r.marker_id"
    )
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(sql, [marker_id])
        row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"marker_id={marker_id} has no records yet.")
    m, dn, t, ok, wn = row
    return {
        "marker_id": m, "device_name": dn, "total": t,
        "ok_count": ok, "warn_count": wn,
        "ok_rate": round(ok / t, 4) if t else 0,
    }
