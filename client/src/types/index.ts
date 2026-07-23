export interface User {
  id: number
  name: string
  email: string
  created_at: string
}

export interface Todo {
  id: number
  title: string
  description: string | null
  completed: boolean
  created_at: string
  updated_at: string
}

export interface TodoCreate {
  title: string
  description?: string
}

export interface TodoUpdate {
  title?: string
  description?: string | null
  completed?: boolean
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface TelegramLoginRequestResult {
  message: string
  expires_at: string
  expires_in: number
}

export interface TelegramPairCreateResult {
  session_id: string
  code: string
  expires_at: string
  expires_in: number
  bot_username: string | null
  bot_link: string | null
}

export interface TelegramPairStatusResult {
  status: 'pending' | 'confirmed' | 'expired' | 'consumed'
  access_token?: string | null
  token_type?: string | null
}

export interface TelegramStatus {
  connected: boolean
  bot_username: string | null
  deep_link: string | null
  bot_configured: boolean
}

export interface Reminder {
  id: number
  title: string
  note: string | null
  remind_at: string
  is_sent: boolean
  sent_at: string | null
  created_at: string
}
