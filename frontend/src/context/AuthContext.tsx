import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiClientError, authApi } from '../api/client'
import type { LoginPayload, User } from '../api/types'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const currentUser = await authApi.me()
      setUser(currentUser)
      return currentUser
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setUser(null)
        return null
      }
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(async (payload: LoginPayload): Promise<User> => {
    const loggedInUser = await authApi.login(payload)
    setUser(loggedInUser)
    return loggedInUser
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
