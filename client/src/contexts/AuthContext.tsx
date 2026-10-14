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
  // Not the real secret anymore — the actual session lives only in an
  // httpOnly cookie the server sets, invisible to this JS. `token` is now
  // just a truthy sentinel ('session') so existing `if (!token) return`
  // guards and `Authorization: Bearer ${token}` headers elsewhere in the
  // app keep working harmlessly; the server authenticates via the cookie.
  token: string | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  login: (user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

const SESSION_SENTINEL = 'session'

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * `initialUser` is who the server found in the session cookie while rendering
 * the page (lib/serverSession.ts): null for nobody, undefined if it didn't
 * check. When given, the very first render already shows the right user, so
 * a refresh never flashes the signed-out page first.
 */
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser?: User | null }) {
  const [auth, setAuth] = useState<AuthState>(() =>
    initialUser === undefined
      ? { user: null, token: null, loading: true }
      : { user: initialUser, token: initialUser ? SESSION_SENTINEL : null, loading: false },
  )
  const knownFromServer = initialUser !== undefined

  useEffect(() => {
    if (knownFromServer) return
    // The token itself is httpOnly and can't be read here — rehydrate the
    // session by asking the server to verify the cookie it already has.
    fetch('/api/users/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.id) {
          setAuth({
            token: SESSION_SENTINEL,
            user: { id: data.id, name: data.name, email: data.email, role: data.role },
            loading: false,
          })
        } else {
          setAuth({ token: null, user: null, loading: false })
        }
      })
      .catch(() => setAuth({ token: null, user: null, loading: false }))
  }, [knownFromServer])

  function login(user: User) {
    setAuth({ token: SESSION_SENTINEL, user, loading: false })
  }

  function logout() {
    setAuth({ token: null, user: null, loading: false })
    // The server reads the session from the cookie itself, so no manual
    // Authorization header is needed here — the browser sends it automatically.
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
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
