import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWSLive } from '../hooks/useWSLive'
import { LayoutDashboard, Bell, Settings, LogOut, Eye } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Layout() {
  const { user, logout } = useAuth()
  const { connected }    = useWSLive()
  const navigate = useNavigate()
  const [time, setTime]  = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const navItem = (to, Icon, label) => (
    <NavLink to={to} end={to==='/'} className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all
       ${isActive ? 'bg-accent/10 text-accent border border-accent/20' : 'text-muted hover:text-white hover:bg-white/5'}`
    }>
      <Icon size={16}/> {label}
    </NavLink>
  )

  return (
    <div className="min-h-screen bg-bg grid-bg flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border bg-bg/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center text-lg">👁️</div>
          <div>
            <div className="text-accent font-bold text-sm tracking-widest">CROWDGUARD EC-9</div>
            <div className="text-muted font-mono text-[10px] tracking-wider">AUTONOMOUS CROWD DENSITY PREDICTION</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono
            ${connected ? 'border-safe text-safe bg-safe/10' : 'border-danger text-danger bg-danger/10'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-safe animate-blink' : 'bg-danger'}`}/>
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
          <div className="text-muted font-mono text-xs">
            {time.toLocaleTimeString('en-IN', { hour12: false })}
          </div>
          <div className="text-xs text-muted">
            <span className="text-accent font-semibold">{user?.name}</span>
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono bg-accent/10 text-accent border border-accent/20">
              {user?.role?.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-panel/50 p-4 flex flex-col gap-2">
          {navItem('/', LayoutDashboard, 'Dashboard')}
          {navItem('/alerts', Bell, 'Alerts')}
          {user?.role === 'admin' && navItem('/admin', Settings, 'Admin')}
          <div className="mt-auto">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted hover:text-danger hover:bg-danger/10 transition-all">
              <LogOut size={16}/> Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
