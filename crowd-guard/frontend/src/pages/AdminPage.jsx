import { useEffect, useState } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [zones, setZones]     = useState([])
  const [editing, setEditing] = useState(null)   // zone_id
  const [form, setForm]       = useState({})
  const [loading, setLoading] = useState(true)

  const fetchZones = () =>
    api.get('/api/zones/').then(r => setZones(r.data)).finally(() => setLoading(false))

  useEffect(() => { fetchZones() }, [])

  const startEdit = zone => {
    setEditing(zone.zone_id)
    setForm({ name: zone.name, capacity: zone.capacity, location: zone.location })
  }

  const saveEdit = async zone_id => {
    try {
      await api.patch(`/api/zones/${zone_id}`, form)
      toast.success('Zone updated')
      setEditing(null)
      fetchZones()
    } catch { toast.error('Update failed') }
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div>
        <h2 className="text-lg font-bold text-white">Admin Panel</h2>
        <p className="text-xs text-muted font-mono mt-0.5">Manage zones, capacity thresholds and locations</p>
      </div>

      {loading ? (
        <div className="text-center text-muted font-mono py-12">Loading...</div>
      ) : (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Zone ID','Name','Location','Capacity','Current','Density','Status','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-mono text-muted tracking-widest uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map(z => (
                <tr key={z.zone_id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-accent font-bold">{z.zone_id}</td>
                  <td className="px-4 py-3">
                    {editing === z.zone_id
                      ? <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
                          className="bg-bg border border-border rounded px-2 py-1 text-white text-xs w-36 focus:outline-none focus:border-accent"/>
                      : <span className="text-white">{z.name}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editing === z.zone_id
                      ? <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}
                          className="bg-bg border border-border rounded px-2 py-1 text-white text-xs w-28 focus:outline-none focus:border-accent"/>
                      : <span className="text-muted text-xs">{z.location}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editing === z.zone_id
                      ? <input type="number" value={form.capacity} onChange={e=>setForm({...form,capacity:+e.target.value})}
                          className="bg-bg border border-border rounded px-2 py-1 text-white text-xs w-20 focus:outline-none focus:border-accent"/>
                      : <span className="font-mono text-xs">{z.capacity}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{z.count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${z.density_pct}%`,
                            background: z.density_pct>=80?'#ff3b5c':z.density_pct>=60?'#ffaa00':'#00e676' }}/>
                      </div>
                      <span className="font-mono text-xs text-muted">{Math.round(z.density_pct)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded border
                      ${z.status==='critical' ? 'text-danger border-danger/30 bg-danger/10' :
                        z.status==='warning'  ? 'text-warn border-warn/30 bg-warn/10' :
                                                'text-safe border-safe/30 bg-safe/10'}`}>
                      {z.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editing === z.zone_id ? (
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(z.zone_id)}
                          className="text-xs text-safe border border-safe/30 bg-safe/10 px-3 py-1 rounded hover:bg-safe/20 transition-all">Save</button>
                        <button onClick={() => setEditing(null)}
                          className="text-xs text-muted border border-border px-3 py-1 rounded hover:border-muted transition-all">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(z)}
                        className="text-xs text-accent border border-accent/30 bg-accent/10 px-3 py-1 rounded hover:bg-accent/20 transition-all">Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* System info */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'CV Engine', value: 'YOLOv8 Simulation', status: 'ONLINE' },
          { label: 'AI Model',  value: 'LSTM Predictor',    status: 'ONLINE' },
          { label: 'WebSocket', value: 'Live Broadcast',    status: 'ACTIVE' },
        ].map(s => (
          <div key={s.label} className="bg-panel border border-border rounded-xl p-4">
            <div className="text-[10px] font-mono text-muted tracking-widest mb-2">{s.label}</div>
            <div className="text-white text-sm font-semibold">{s.value}</div>
            <div className="text-safe text-xs font-mono mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-safe animate-blink"/>
              {s.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
