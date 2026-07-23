import { request, setToken } from './client'
import type { AuthResponse, User } from '../types'

export async function register(name: string, email: string, password: string): Promise<User> {
  return request<User>('/auth/register', {
    method: 'POST',
    body: { name, email, password },
    auth: false,
  })
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const form = new URLSearchParams()
  form.set('username', email)
  form.set('password', password)

  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: form.toString(),
    auth: false,
    form: true,
  })

  setToken(data.access_token)
  return data
}

export async function requestTelegramLogin(email: string): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/telegram/request', {
    method: 'POST',
    body: { email },
    auth: false,
  })
}

export async function verifyTelegramLogin(email: string, code: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/telegram/verify', {
    method: 'POST',
    body: { email, code },
    auth: false,
  })
  setToken(data.access_token)
  return data
}

export async function getMe(): Promise<User> {
  return request<User>('/auth/me')
}

export function logout(): void {
  setToken(null)
}
