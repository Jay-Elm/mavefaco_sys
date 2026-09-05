'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ user: null, token: null, loading: true })

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    let next: AuthState = { user: null, token: null, loading: false }

    if (storedToken && storedUser) {
      try {
        next = { token: storedToken, user: JSON.parse(storedUser), loading: false }
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuth(next)
  }, [])

  function login(token: string, user: User) {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setAuth({ token, user, loading: false })
  }

  function logout() {
    const currentToken = auth.token
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setAuth({ token: null, user: null, loading: false })

    // Best-effort: invalidate the token server-side so it can't be reused
    // even if it was copied out of localStorage before logout.
    if (currentToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {})
    }
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated: !!auth.token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
