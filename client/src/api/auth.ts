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

export async function getMe(): Promise<User> {
  return request<User>('/auth/me')
}

export function logout(): void {
  setToken(null)
}
