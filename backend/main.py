from fastapi import FastAPI, Query, HTTPException, File, UploadFile
from pydantic import BaseModel
import sqlite3
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import uuid
from enum import Enum
from typing import Optional
import shutil

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Uploads directory ---
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- Enums & Models ---

class InspectionStatus(str, Enum):
    ok   = "ok"
    warn = "warn"

class InspectionData(BaseModel):
    marker_id: int
    status: InspectionStatus

class DeviceCreate(BaseModel):
    marker_id:        int
    name:             str
    description:      Optional[str] = None
    work_instruction: Optional[str] = None
    image_url:        Optional[str] = None

class DeviceUpdate(BaseModel):
    name:             Optional[str] = None
    description:      Optional[str] = None
    work_instruction: Optional[str] = None
    image_url:        Optional[str] = None

# --- Default devices ---

_DEFAULT_DEVICES = [
    {"marker_id": 0, "name": "INPUT 輸入端",    "description": "UPS INPUT",
     "work_instruction": "1. 確認輸入電壓正常 (220V±10%)\n2. 檢查電纜接頭無鬆脫\n3. 確認指示燈為綠色"},
    {"marker_id": 1, "name": "OUTPUT 輸出端",  "description": "UPS OUTPUT",
     "work_instruction": "1. 確認輸出電壓穩定 (220V)\n2. 量測輸出電流不超過額定值\n3. 檢查負載連接狀況"},
    {"marker_id": 2, "name": "BATTERY 電池組", "description": "UPS BATTERY",
     "work_instruction": "1. 確認電池電壓 ≥ 48V\n2. 觀察電池溫度無異常發熱\n3. 確認充電指示燈正常"},
]

# --- DB init ---

def init_db():
    with sqlite3.connect("inspection.db") as conn:
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

init_db()

# ============================================================
# Device Management APIs
# ============================================================

def _row_to_device(r):
    return {
        "marker_id":        r[0],
        "name":             r[1],
        "description":      r[2],
        "created_at":       r[3],
        "work_instruction": r[4],
        "image_url":        r[5],
    }

@app.get("/devices")
def get_devices():
    with sqlite3.connect("inspection.db") as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT marker_id, name, description, created_at, work_instruction, image_url "
            "FROM devices ORDER BY marker_id"
        )
        rows = cursor.fetchall()
    return [_row_to_device(r) for r in rows]


@app.get("/devices/{marker_id}")
def get_device(marker_id: int):
    with sqlite3.connect("inspection.db") as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT marker_id, name, description, created_at, work_instruction, image_url "
            "FROM devices WHERE marker_id = ?", [marker_id]
        )
        row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return _row_to_device(row)


@app.post("/devices", status_code=201)
def create_device(data: DeviceCreate):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with sqlite3.connect("inspection.db") as conn:
            conn.execute(
                "INSERT INTO devices "
                "(marker_id, name, description, created_at, work_instruction, image_url) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (data.marker_id, data.name, data.description, now,
                 data.work_instruction, data.image_url),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="marker_id already exists. Use PATCH to update.")
    return {"message": "Device created", "marker_id": data.marker_id, "name": data.name}


@app.patch("/devices/{marker_id}")
def update_device(marker_id: int, data: DeviceUpdate):
    if all(v is None for v in [data.name, data.description, data.work_instruction, data.image_url]):
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    fields, params = [], []
    if data.name             is not None: fields.append("name = ?");             params.append(data.name)
    if data.description      is not None: fields.append("description = ?");      params.append(data.description)
    if data.work_instruction is not None: fields.append("work_instruction = ?"); params.append(data.work_instruction)
    if data.image_url        is not None: fields.append("image_url = ?");        params.append(data.image_url)
    params.append(marker_id)
    with sqlite3.connect("inspection.db") as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE devices SET " + ", ".join(fields) + " WHERE marker_id = ?", params)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="marker_id not found")
    return {"message": "Device updated", "marker_id": marker_id}


@app.post("/devices/{marker_id}/image")
async def upload_device_image(marker_id: int, file: UploadFile = File(...)):
    """Upload an image for a device. Returns the public URL."""
    # Validate device exists
    with sqlite3.connect("inspection.db") as conn:
        row = conn.execute("SELECT marker_id FROM devices WHERE marker_id = ?", [marker_id]).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Device not found")

    ext = os.path.splitext(file.filename or "image.jpg")[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        raise HTTPException(status_code=422, detail="Unsupported image type")

    filename  = f"device_{marker_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    image_url = f"/uploads/{filename}"
    with sqlite3.connect("inspection.db") as conn:
        conn.execute("UPDATE devices SET image_url = ? WHERE marker_id = ?", [image_url, marker_id])

    return {"message": "Image uploaded", "marker_id": marker_id, "image_url": image_url}


@app.delete("/devices/{marker_id}", status_code=200)
def delete_device(marker_id: int):
    with sqlite3.connect("inspection.db") as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM devices WHERE marker_id = ?", [marker_id])
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Device not found")
    return {"message": "Deleted", "marker_id": marker_id}


# ============================================================
# Inspection APIs
# ============================================================

@app.get("/results")
def get_results(
    marker_id: Optional[int] = Query(None),
    start:     Optional[str] = Query(None),
    end:       Optional[str] = Query(None),
):
    conditions, params = [], []
    if marker_id is not None:
        conditions.append("r.marker_id = ?"); params.append(marker_id)
    if start:
        conditions.append("r.update_time >= ?"); params.append(start)
    if end:
        conditions.append("r.update_time <= ?"); params.append(end)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    sql = (
        "SELECT r.id, r.status, r.update_time, r.marker_id, "
        "COALESCE(d.name, 'Unknown') AS device_name "
        "FROM results r LEFT JOIN devices d ON r.marker_id = d.marker_id "
        + where + " ORDER BY r.update_time DESC"
    )
    with sqlite3.connect("inspection.db") as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        data = cursor.fetchall()
    return {
        item[0]: {"status": item[1], "time": item[2], "marker_id": item[3], "device_name": item[4]}
        for item in data
    }


@app.post("/update")
def update_result(data: InspectionData):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_uuid = str(uuid.uuid4())
    with sqlite3.connect("inspection.db") as conn:
        conn.execute(
            "INSERT INTO results (id, marker_id, status, update_time) VALUES (?, ?, ?, ?)",
            (new_uuid, data.marker_id, data.status.value, now),
        )
    return {"message": "Success", "id": new_uuid, "time": now}


@app.delete("/results/{record_id}", status_code=200)
def delete_result(record_id: str):
    with sqlite3.connect("inspection.db") as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM results WHERE id = ?", [record_id])
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Deleted", "id": record_id}


@app.get("/stats")
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
    with sqlite3.connect("inspection.db") as conn:
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


@app.get("/stats/{marker_id}")
def get_stats_by_device(marker_id: int):
    sql = (
        "SELECT r.marker_id, COALESCE(d.name, 'Unknown') AS device_name, "
        "COUNT(*) AS total, "
        "SUM(CASE WHEN r.status = 'ok'   THEN 1 ELSE 0 END) AS ok_count, "
        "SUM(CASE WHEN r.status = 'warn' THEN 1 ELSE 0 END) AS warn_count "
        "FROM results r LEFT JOIN devices d ON r.marker_id = d.marker_id "
        "WHERE r.marker_id = ? GROUP BY r.marker_id"
    )
    with sqlite3.connect("inspection.db") as conn:
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


# ============================================================
# Export
# ============================================================

@app.get("/export")
def export_report():
    db_path = "inspection.db"
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
