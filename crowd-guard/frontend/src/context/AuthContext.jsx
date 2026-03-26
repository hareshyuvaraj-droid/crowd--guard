import { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('cg_token')
    if (token) {
      api.get('/api/auth/me')
        .then(r => setUser(r.data))
        .catch(() => localStorage.removeItem('cg_token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    localStorage.setItem('cg_token', data.token)
    setUser({ email, name: data.name, role: data.role })
    return data
  }

  const register = async (name, email, password, role = 'viewer') => {
    const { data } = await api.post('/api/auth/register', { name, email, password, role })
    localStorage.setItem('cg_token', data.token)
    setUser({ email, name: data.name, role: data.role })
    return data
  }

  const logout = () => {
    localStorage.removeItem('cg_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
