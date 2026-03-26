import { useWSLive } from '../hooks/useWSLive'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../utils/api'
import PredictionsPanel from '../components/PredictionsPanel'
import CameraFeeds from '../components/CameraFeeds'

const STATUS_COLOR = { safe: '#00e676', warning: '#ffaa00', critical: '#ff3b5c' }
const STATUS_LABEL = { safe: 'SAFE', warning: 'WARNING', critical: 'CRITICAL' }

function StatCard({ label, value, sub, color = '#00e5ff', trend }) {
  return (
    <div className="bg-panel border border-border rounded-xl p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }}/>
      <div className="text-[10px] font-mono tracking-widest text-muted uppercase mb-2">{label}</div>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-muted mt-1">{sub}</div>
      {trend && <div className="absolute top-4 right-4 text-xs font-mono" style={{ color }}>{trend}</div>}
    </div>
  )
}

const FLOW_ICON  = { influx: '▲', outflow: '▼', stable: '●' }
const FLOW_COLOR = { influx: '#ff3b5c', outflow: '#00e676', stable: '#4a6491' }

function RiskMeter({ score }) {
  const color = score >= 75 ? '#ff3b5c' : score >= 50 ? '#ffaa00' : '#00e676'
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] font-mono mb-1">
        <span className="text-muted">Stampede Risk</span>
        <span style={{ color }} className="font-bold">{score}/100</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}/>
      </div>
    </div>
  )
}

function ZoneCard({ zone }) {
  const color     = STATUS_COLOR[zone.status] || '#00e5ff'
  const flowDir   = zone.flow_direction || 'stable'
  const riskScore = zone.risk_score ?? null
  return (
    <div className={`bg-panel border rounded-xl p-4 relative overflow-hidden transition-all hover:scale-[1.01]
      ${zone.status === 'critical' ? 'border-danger/50 animate-danger' :
        zone.status === 'warning'  ? 'border-warn/40' : 'border-border'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-bold text-sm text-white">{zone.name}</div>
          <div className="text-[10px] font-mono text-muted">Zone {zone.zone_id} · {zone.location || 'Active'}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-mono font-bold px-2 py-1 rounded border"
            style={{ color, borderColor: color + '44', background: color + '11' }}>
            {STATUS_LABEL[zone.status]}
          </span>
          <span className="text-[10px] font-mono" style={{ color: FLOW_COLOR[flowDir] }}>
            {FLOW_ICON[flowDir]} {flowDir}
          </span>
        </div>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${zone.pct || zone.density_pct}%`, background: color }}/>
      </div>
      <div className="flex justify-between text-xs font-mono mb-1">
        <span style={{ color }}>{Math.round(zone.pct || zone.density_pct)}% density</span>
        <span className="text-muted">{zone.count} / {zone.capacity} ppl</span>
      </div>
      {riskScore !== null && <RiskMeter score={riskScore} />}
    </div>
  )
}

export default function Dashboard() {
  const { zones: liveZones, connected, lastTs } = useWSLive()
  const [historyData, setHistoryData] = useState([])
  const [alertStats, setAlertStats]   = useState(null)

  // Use live zones if connected, else fallback to API zones
  const zones = liveZones.length > 0 ? liveZones : []

  useEffect(() => {
    api.get('/api/alerts/stats').then(r => setAlertStats(r.data)).catch(() => {})
  }, [])

  // Build rolling 15-point trend from live data
  useEffect(() => {
    if (zones.length === 0) return
    setHistoryData(prev => {
      const ts = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
      const entry = { time: ts }
      zones.forEach(z => { entry[z.zone_id] = Math.round(z.pct || z.density_pct) })
      const next = [...prev, entry]
      return next.slice(-15)
    })
  }, [lastTs])

  const totalCount    = zones.reduce((s, z) => s + z.count, 0)
  const criticalZones = zones.filter(z => z.status === 'critical')
  const warningZones  = zones.filter(z => z.status === 'warning')
  const peakZone      = zones.length > 0
    ? zones.reduce((a, b) => ((a.pct||a.density_pct||0) > (b.pct||b.density_pct||0) ? a : b))
    : null
  const maxRisk       = zones.length > 0
    ? Math.max(...zones.map(z => z.risk_score ?? 0))
    : null
  const maxRiskColor  = maxRisk >= 75 ? '#ff3b5c' : maxRisk >= 50 ? '#ffaa00' : '#00e676'

  const CHART_COLORS = ['#00e5ff','#ffaa00','#ff3b5c','#00e676','#ff6d00','#a78bfa']

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Alert Banner */}
      {criticalZones.length > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-danger/50 bg-danger/10 animate-danger">
          <span className="text-2xl">🚨</span>
          <div className="flex-1">
            <div className="font-bold text-danger">STAMPEDE RISK — {criticalZones.map(z=>z.name).join(', ')}</div>
            <div className="text-xs text-danger/70 mt-0.5">Density critical — immediate crowd control required</div>
          </div>
          <div className="text-xs font-mono text-danger border border-danger/30 px-3 py-1 rounded">LEVEL 3 — CRITICAL</div>
        </div>
      )}
      {criticalZones.length === 0 && warningZones.length > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-warn/40 bg-warn/8">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <div className="font-bold text-warn">Warning — {warningZones.map(z=>z.name).join(', ')}</div>
            <div className="text-xs text-warn/70 mt-0.5">Approaching critical threshold — monitor closely</div>
          </div>
          <div className="text-xs font-mono text-warn border border-warn/30 px-3 py-1 rounded">LEVEL 2 — WARNING</div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Crowd" value={totalCount.toLocaleString()} sub="All zones combined" color="#00e5ff"/>
        <StatCard label="Zones Monitored" value={zones.length} sub={`${warningZones.length} warn · ${criticalZones.length} critical`} color="#00e676"/>
        <StatCard label="Peak Density" value={`${Math.round(peakZone?.pct || peakZone?.density_pct || 0)}%`}
          sub={peakZone?.name || '—'} color="#ffaa00"/>
        <StatCard label="Max Risk Score" value={maxRisk !== null ? `${maxRisk}/100` : '—'}
          sub="Highest stampede risk" color={maxRiskColor}/>
      </div>

      {/* Zone Cards Grid */}
      <div>
        <div className="text-xs font-mono text-muted tracking-widest uppercase mb-3 flex items-center gap-3">
          Zone Density Map
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-safe animate-blink' : 'bg-danger'}`}/>
          <span>{connected ? 'Live' : 'Offline'}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map(z => <ZoneCard key={z.zone_id} zone={z}/>)}
          {zones.length === 0 && (
            <div className="col-span-3 text-center text-muted font-mono text-sm py-12">
              Connecting to CV engine...
            </div>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      {historyData.length > 2 && (
        <div className="bg-panel border border-border rounded-xl p-5">
          <div className="text-xs font-mono text-accent tracking-widest uppercase mb-4">Density Trend (Live Rolling)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#112240"/>
              <XAxis dataKey="time" tick={{ fill: '#4a6491', fontSize: 10, fontFamily: 'Space Mono' }}/>
              <YAxis domain={[0,100]} tick={{ fill: '#4a6491', fontSize: 10, fontFamily: 'Space Mono' }}
                tickFormatter={v => v+'%'}/>
              <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid #112240', borderRadius: 8, fontSize: 11 }}/>
              {zones.map((z, i) => (
                <Line key={z.zone_id} type="monotone" dataKey={z.zone_id}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2} dot={false} name={z.name}/>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Camera Feeds + Predictions side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CameraFeeds zones={zones} />
        </div>
        <PredictionsPanel />
      </div>
    </div>
  )
}
