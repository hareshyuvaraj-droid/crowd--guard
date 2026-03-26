from fastapi import APIRouter, Depends, Query
from typing import Optional
from models import Alert, AlertLevel
from auth.routes import get_current_user, require_admin
from datetime import datetime

router = APIRouter()

@router.get("/stats")
async def alert_stats(user=Depends(get_current_user)):
    total      = await Alert.count()
    critical   = await Alert.find(Alert.level == AlertLevel.critical).count()
    warning    = await Alert.find(Alert.level == AlertLevel.warning).count()
    unresolved = await Alert.find(Alert.resolved == False).count()
    return {"total": total, "critical": critical, "warning": warning, "unresolved": unresolved}

@router.get("/")
async def get_alerts(
    limit: int = Query(50, le=200),
    zone_id: Optional[str] = None,
    level: Optional[AlertLevel] = None,
    user=Depends(get_current_user)
):
    query = Alert.find()
    if zone_id: query = Alert.find(Alert.zone_id == zone_id)
    if level:   query = query.find(Alert.level == level)
    alerts = await query.sort(-Alert.timestamp).limit(limit).to_list()
    return [{"id": str(a.id), "zone_id": a.zone_id, "zone_name": a.zone_name,
             "level": a.level, "message": a.message, "density_pct": a.density_pct,
             "count": a.count, "resolved": a.resolved,
             "timestamp": a.timestamp.isoformat()} for a in alerts]

@router.patch("/{alert_id}/resolve")
async def resolve_alert(alert_id: str, admin=Depends(require_admin)):
    alert = await Alert.get(alert_id)
    if not alert:
        from fastapi import HTTPException
        raise HTTPException(404, "Alert not found")
    alert.resolved = True
    await alert.save()
    return {"message": "Alert resolved"}
