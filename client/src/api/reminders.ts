import type { Reminder, TelegramStatus } from '../types'
import { request } from './client'

export function getTelegramStatus(): Promise<TelegramStatus> {
  return request<TelegramStatus>('/telegram/status')
}

export function createTelegramLink(): Promise<TelegramStatus> {
  return request<TelegramStatus>('/telegram/link', { method: 'POST' })
}

export function unlinkTelegram(): Promise<TelegramStatus> {
  return request<TelegramStatus>('/telegram/unlink', { method: 'DELETE' })
}

export function fetchReminders(): Promise<Reminder[]> {
  return request<Reminder[]>('/reminders')
}

export function createReminder(payload: {
  title: string
  note?: string
  remind_at: string
}): Promise<Reminder> {
  return request<Reminder>('/reminders', { method: 'POST', body: payload })
}

export function deleteReminder(id: number): Promise<void> {
  return request<void>(`/reminders/${id}`, { method: 'DELETE' })
}
