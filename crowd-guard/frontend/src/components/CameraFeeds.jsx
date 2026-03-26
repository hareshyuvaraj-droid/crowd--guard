import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

const ZONE_CAMS = [
  { zone_id: 'A', name: 'Entrance Plaza' },
  { zone_id: 'B', name: 'Main Hall' },
  { zone_id: 'C', name: 'Gate B' },
  { zone_id: 'D', name: 'Food Court' },
]

export default function CameraFeeds({ zones = [] }) {
  const [errors, setErrors] = useState({})

  const getZone = id => zones.find(z => z.zone_id === id) || {}
  const statusColor = s => s==='critical'?'#ff3b5c': s==='warning'?'#ffaa00':'#00e676'

  return (
    <div className="bg-panel border border-border rounded-xl p-5">
      <div className="text-xs font-mono text-accent tracking-widest uppercase mb-4">
        Live Camera Feeds
        <span className="ml-2 text-muted normal-case">YOLOv8 Person Detection</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ZONE_CAMS.map(cam => {
          const zone = getZone(cam.zone_id)
          const color = statusColor(zone.status)
          const streamUrl = `${API_BASE}/api/stream/${cam.zone_id}`
          const hasError  = errors[cam.zone_id]

          return (
            <div key={cam.zone_id}
              className="relative bg-bg rounded-lg overflow-hidden border border-border"
              style={{ aspectRatio: '4/3' }}>

              {/* MJPEG stream — falls back to placeholder if no real camera */}
              {!hasError ? (
                <img
                  src={streamUrl}
                  alt={`Zone ${cam.zone_id} feed`}
                  className="w-full h-full object-cover"
                  onError={() => setErrors(e => ({ ...e, [cam.zone_id]: true }))}
                />
              ) : (
                /* Placeholder when no camera available */
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-bg">
                  <div className="text-3xl opacity-30">📷</div>
                  <div className="text-[10px] font-mono text-muted">No camera source</div>
                  <div className="text-[10px] font-mono text-muted">Configure CAMERA_SOURCES</div>
                </div>
              )}

              {/* REC indicator */}
              <div className="absolute top-2 right-2 flex items-center gap-1 text-danger text-[9px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-blink"/>REC
              </div>

              {/* Bottom overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-[10px] font-mono font-bold text-white">CAM-0{cam.zone_id}</div>
                    <div className="text-[9px] font-mono text-white/60">{cam.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold" style={{ color }}>
                      {zone.count || '—'}
                    </div>
                    <div className="text-[9px] font-mono" style={{ color }}>
                      {Math.round(zone.pct || zone.density_pct || 0)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
