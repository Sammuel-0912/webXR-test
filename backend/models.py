"""Pydantic schema 與 enum 定義（請求/回應的資料結構）。"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel


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
