import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage    from './pages/LoginPage'
import Dashboard    from './pages/Dashboard'
import AlertsPage   from './pages/AlertsPage'
import AdminPage    from './pages/AdminPage'
import Layout       from './components/Layout'

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-bg grid-bg flex items-center justify-center">
      <div className="text-accent font-mono text-sm animate-pulse">Initializing CrowdGuard...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#0a1628', color: '#ccd6f6', border: '1px solid #112240' }
        }}/>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="admin" element={<PrivateRoute adminOnly><AdminPage /></PrivateRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
