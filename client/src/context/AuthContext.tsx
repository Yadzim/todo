import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as authApi from '../api/auth'
import { setToken } from '../api/client'
import type { TelegramLoginRequestResult, TelegramPairCreateResult, User } from '../types'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithTelegram: (email: string, code: string) => Promise<void>
  requestTelegramCode: (email: string) => Promise<TelegramLoginRequestResult>
  createTelegramPair: () => Promise<TelegramPairCreateResult>
  pollTelegramPair: (sessionId: string) => Promise<'pending' | 'confirmed' | 'expired' | 'consumed'>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    authApi
      .getMe()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password)
    const me = await authApi.getMe()
    setUser(me)
  }, [])

  const requestTelegramCode = useCallback(async (email: string) => {
    return authApi.requestTelegramLogin(email)
  }, [])

  const loginWithTelegram = useCallback(async (email: string, code: string) => {
    await authApi.verifyTelegramLogin(email, code)
    const me = await authApi.getMe()
    setUser(me)
  }, [])

  const createTelegramPair = useCallback(async () => {
    return authApi.createTelegramPair()
  }, [])

  const pollTelegramPair = useCallback(async (sessionId: string) => {
    const status = await authApi.getTelegramPairStatus(sessionId)
    if (status.status === 'confirmed' && status.access_token) {
      setToken(status.access_token)
      const me = await authApi.getMe()
      setUser(me)
    }
    return status.status
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    await authApi.register(name, email, password)
    await authApi.login(email, password)
    const me = await authApi.getMe()
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      loginWithTelegram,
      requestTelegramCode,
      createTelegramPair,
      pollTelegramPair,
      register,
      logout,
    }),
    [
      user,
      loading,
      login,
      loginWithTelegram,
      requestTelegramCode,
      createTelegramPair,
      pollTelegramPair,
      register,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak')
  return ctx
}
