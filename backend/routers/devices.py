"""設備管理 API（CRUD + 圖片上傳）。路由路徑與回傳格式與原 main.py 完全一致。"""

import os
import shutil
import sqlite3
import uuid
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile

from db import ALLOWED_IMAGE_EXTENSIONS, DB_PATH, UPLOAD_DIR
from models import DeviceCreate, DeviceUpdate

router = APIRouter(tags=["devices"])


def _row_to_device(r):
    return {
        "marker_id":        r[0],
        "name":             r[1],
        "description":      r[2],
        "created_at":       r[3],
        "work_instruction": r[4],
        "image_url":        r[5],
    }


@router.get("/devices")
def get_devices():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT marker_id, name, description, created_at, work_instruction, image_url "
            "FROM devices ORDER BY marker_id"
        )
        rows = cursor.fetchall()
    return [_row_to_device(r) for r in rows]


@router.get("/devices/{marker_id}")
def get_device(marker_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT marker_id, name, description, created_at, work_instruction, image_url "
            "FROM devices WHERE marker_id = ?", [marker_id]
        )
        row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return _row_to_device(row)


@router.post("/devices", status_code=201)
def create_device(data: DeviceCreate):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with sqlite3.connect(DB_PATH) as conn:
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


@router.patch("/devices/{marker_id}")
def update_device(marker_id: int, data: DeviceUpdate):
    if all(v is None for v in [data.name, data.description, data.work_instruction, data.image_url]):
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    fields, params = [], []
    if data.name             is not None: fields.append("name = ?");             params.append(data.name)
    if data.description      is not None: fields.append("description = ?");      params.append(data.description)
    if data.work_instruction is not None: fields.append("work_instruction = ?"); params.append(data.work_instruction)
    if data.image_url        is not None: fields.append("image_url = ?");        params.append(data.image_url)
    params.append(marker_id)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE devices SET " + ", ".join(fields) + " WHERE marker_id = ?", params)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="marker_id not found")
    return {"message": "Device updated", "marker_id": marker_id}


@router.post("/devices/{marker_id}/image")
async def upload_device_image(marker_id: int, file: UploadFile = File(...)):
    """Upload an image for a device. Returns the public URL."""
    # Validate device exists
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT marker_id FROM devices WHERE marker_id = ?", [marker_id]).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Device not found")

    ext = os.path.splitext(file.filename or "image.jpg")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Unsupported image type")

    filename  = f"device_{marker_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    image_url = f"/uploads/{filename}"
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("UPDATE devices SET image_url = ? WHERE marker_id = ?", [image_url, marker_id])

    return {"message": "Image uploaded", "marker_id": marker_id, "image_url": image_url}


@router.delete("/devices/{marker_id}", status_code=200)
def delete_device(marker_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM devices WHERE marker_id = ?", [marker_id])
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Device not found")
    return {"message": "Deleted", "marker_id": marker_id}
