import { useEffect, useState } from 'react'
import api from '../utils/api'

export default function PredictionsPanel() {
  const [preds, setPreds]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () =>
      api.get('/api/predictions')
         .then(r => setPreds(r.data))
         .catch(() => {})
         .finally(() => setLoading(false))
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  if (loading) return (
    <div className="bg-panel border border-border rounded-xl p-5">
      <div className="text-xs font-mono text-muted animate-pulse">Loading LSTM predictions...</div>
    </div>
  )

  const risky = preds.filter(p => p.will_exceed_80)

  return (
    <div className="bg-panel border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-mono text-accent tracking-widest uppercase">AI Predictions</div>
          <div className="text-[10px] text-muted font-mono mt-0.5">LSTM · 15-min forecast per zone</div>
        </div>
        {risky.length > 0 && (
          <div className="text-[10px] font-mono text-danger border border-danger/30 bg-danger/10 px-2 py-1 rounded animate-blink">
            ⚠ {risky.length} ZONE{risky.length > 1 ? 'S' : ''} AT RISK
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {preds.filter(p => p.next_1min !== null).map(p => {
          const peak      = Math.max(p.next_1min||0, p.next_5min||0, p.next_10min||0, p.next_15min||0)
          const color     = peak >= 80 ? '#ff3b5c' : peak >= 60 ? '#ffaa00' : '#00e676'
          const confColor = p.confidence >= 80 ? '#00e676' : p.confidence >= 60 ? '#ffaa00' : '#ff3b5c'

          return (
            <div key={p.zone_id} className="p-3 rounded-lg bg-bg/50 border border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold" style={{ color }}>Zone {p.zone_id}</span>
                <span className="text-[10px] font-mono" style={{ color: confColor }}>
                  conf: {p.confidence}%
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono mb-2">
                {[['1m', p.next_1min], ['5m', p.next_5min], ['10m', p.next_10min], ['15m', p.next_15min]].map(([label, val]) => {
                  const c = val >= 80 ? '#ff3b5c' : val >= 60 ? '#ffaa00' : '#00e676'
                  return (
                    <div key={label} className="flex flex-col items-center bg-border/30 rounded p-1">
                      <span className="text-muted mb-0.5">{label}</span>
                      <span className="font-bold" style={{ color: c }}>
                        {val !== null && val !== undefined ? `${val}%` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {p.eta_critical !== null && p.eta_critical !== undefined ? (
                <div className="text-[10px] font-mono text-danger bg-danger/10 border border-danger/20 rounded px-2 py-1">
                  ⚡ Critical in ~{p.eta_critical} min — pre-emptive action needed
                </div>
              ) : p.will_exceed_60 ? (
                <div className="text-[10px] font-mono text-warn">
                  ⚠ Will exceed 60% — monitor closely
                </div>
              ) : null}
            </div>
          )
        })}

        {preds.length === 0 && (
          <div className="text-center text-muted font-mono text-xs py-6">
            Waiting for LSTM to warm up...
          </div>
        )}
      </div>
    </div>
  )
}
