from beanie import Document
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

class AlertLevel(str, Enum):
    safe     = "safe"
    warning  = "warning"
    critical = "critical"

class User(Document):
    name:       str
    email:      EmailStr
    password:   str          # hashed
    role:       str = "viewer"  # viewer | admin
    created_at: datetime = datetime.utcnow()

    class Settings:
        name = "users"

class Zone(Document):
    zone_id:    str           # e.g. "A"
    name:       str
    capacity:   int
    count:      int = 0
    density_pct: float = 0.0
    status:     AlertLevel = AlertLevel.safe
    location:   str = ""
    updated_at: datetime = datetime.utcnow()

    class Settings:
        name = "zones"

class Alert(Document):
    zone_id:    str
    zone_name:  str
    level:      AlertLevel
    message:    str
    density_pct: float
    count:      int
    resolved:   bool = False
    timestamp:  datetime = datetime.utcnow()

    class Settings:
        name = "alerts"
