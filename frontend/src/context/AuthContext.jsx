import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setCsrfToken } from '../api/client'

// Administrator authentication only. There is no public visitor account system.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready

  const apply = useCallback((data) => {
    setCsrfToken(data?.csrf_token)
    setAdmin(data?.admin || null)
  }, [])

  useEffect(() => {
    api
      .get('/api/admin/auth/me')
      .then((res) => apply(res.data))
      .catch(() => apply(null))
      .finally(() => setStatus('ready'))
  }, [apply])

  const login = useCallback(
    async (username, password) => {
      const res = await api.post('/api/admin/auth/login', { username, password })
      apply(res.data)
      return res.data.admin
    },
    [apply],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/api/admin/auth/logout')
    } finally {
      apply(null)
    }
  }, [apply])

  const changePassword = useCallback(
    async (payload) => {
      const res = await api.post('/api/admin/auth/password', payload)
      apply(res.data)
      return res.data.admin
    },
    [apply],
  )

  // If the session expires mid-use, the next 401 sends the admin back to sign in.
  const handleAuthError = useCallback(
    (err) => {
      if (err?.status === 401) apply(null)
    },
    [apply],
  )

  const value = useMemo(
    () => ({ admin, status, login, logout, changePassword, handleAuthError }),
    [admin, status, login, logout, changePassword, handleAuthError],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
