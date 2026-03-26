import { useEffect, useState } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const LEVEL_COLOR = { safe: '#00e676', warning: '#ffaa00', critical: '#ff3b5c' }
const LEVEL_ICON  = { safe: '✅', warning: '⚠️', critical: '🚨' }

export default function AlertsPage() {
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const { user } = useAuth()

  const fetchAlerts = () => {
    const params = filter !== 'all' ? `?level=${filter}` : ''
    api.get(`/api/alerts/${params}`).then(r => setAlerts(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchAlerts() }, [filter])

  const resolve = async id => {
    try {
      await api.patch(`/api/alerts/${id}/resolve`)
      toast.success('Alert resolved')
      fetchAlerts()
    } catch { toast.error('Failed to resolve') }
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Alert History</h2>
          <p className="text-xs text-muted font-mono mt-0.5">All system-generated crowd density alerts</p>
        </div>
        <div className="flex gap-2">
          {['all','critical','warning','safe'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider border transition-all
                ${filter===f ? 'bg-accent/10 text-accent border-accent/30' : 'text-muted border-border hover:border-muted'}`}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted font-mono py-12">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center text-muted font-mono py-12">No alerts found</div>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map(a => {
            const color = LEVEL_COLOR[a.level] || '#00e5ff'
            return (
              <div key={a.id} className={`bg-panel border rounded-xl p-4 flex items-start gap-4
                ${a.resolved ? 'opacity-50' : ''}`}
                style={{ borderColor: color + '33' }}>
                <div className="text-xl">{LEVEL_ICON[a.level]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-sm" style={{ color }}>{a.zone_name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border"
                      style={{ color, borderColor: color+'44', background: color+'11' }}>
                      {a.level.toUpperCase()}
                    </span>
                    {a.resolved && <span className="text-[10px] font-mono text-safe border border-safe/30 bg-safe/10 px-2 py-0.5 rounded">RESOLVED</span>}
                  </div>
                  <p className="text-sm text-white/80 mb-1">{a.message}</p>
                  <div className="flex gap-4 text-xs font-mono text-muted">
                    <span>Density: <b style={{ color }}>{a.density_pct}%</b></span>
                    <span>Count: {a.count}</span>
                    <span>{new Date(a.timestamp).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                {!a.resolved && user?.role === 'admin' && (
                  <button onClick={() => resolve(a.id)}
                    className="text-xs font-mono text-safe border border-safe/30 bg-safe/10 px-3 py-1.5 rounded-lg hover:bg-safe/20 transition-all whitespace-nowrap">
                    Resolve
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
