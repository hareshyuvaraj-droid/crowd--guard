import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [mode, setMode]       = useState('login')   // login | register
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [role, setRole]       = useState('viewer')
  const [loading, setLoading] = useState(false)
  const { login, register }   = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        toast.success('Welcome back!')
      } else {
        await register(name, email, password, role)
        toast.success('Account created!')
      }
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg grid-bg flex items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"/>

      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center text-3xl mx-auto mb-4">👁️</div>
          <h1 className="text-accent font-bold text-xl tracking-widest">CROWDGUARD EC-9</h1>
          <p className="text-muted text-xs font-mono mt-1 tracking-widest">AUTONOMOUS CROWD DENSITY PREDICTION SYSTEM</p>
        </div>

        <div className="bg-panel border border-border rounded-2xl p-8">
          <div className="flex gap-2 mb-6 p-1 bg-bg rounded-xl">
            {['login','register'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold tracking-wider transition-all
                  ${mode===m ? 'bg-accent/10 text-accent border border-accent/20' : 'text-muted hover:text-white'}`}>
                {m === 'login' ? 'SIGN IN' : 'REGISTER'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-mono text-muted tracking-wider mb-2 block">FULL NAME</label>
                <input value={name} onChange={e=>setName(e.target.value)} required
                  className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
                  placeholder="John Doe" />
              </div>
            )}
            <div>
              <label className="text-xs font-mono text-muted tracking-wider mb-2 block">EMAIL</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
                placeholder="operator@crowdguard.ai"/>
            </div>
            <div>
              <label className="text-xs font-mono text-muted tracking-wider mb-2 block">PASSWORD</label>
              <input type="password" value={password} onChange={e=>setPass(e.target.value)} required
                className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
                placeholder="••••••••"/>
            </div>
            {mode === 'register' && (
              <div>
                <label className="text-xs font-mono text-muted tracking-wider mb-2 block">ROLE</label>
                <select value={role} onChange={e=>setRole(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-accent transition-colors">
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="admin">Admin (Full access)</option>
                </select>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="mt-2 w-full py-3 rounded-lg bg-accent/10 border border-accent/30 text-accent font-bold text-sm tracking-widest hover:bg-accent/20 transition-all disabled:opacity-50">
              {loading ? 'AUTHENTICATING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <div className="mt-6 p-3 bg-bg/50 rounded-lg border border-border">
            <p className="text-xs text-muted font-mono text-center">
              Demo: register with role <span className="text-accent">admin</span> for full access
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
