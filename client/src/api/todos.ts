import { request } from './client'
import type { Todo, TodoCreate, TodoUpdate } from '../types'

export function fetchTodos(): Promise<Todo[]> {
  return request<Todo[]>('/todos')
}

export function createTodo(payload: TodoCreate): Promise<Todo> {
  return request<Todo>('/todos', { method: 'POST', body: payload })
}

export function updateTodo(id: number, payload: TodoUpdate): Promise<Todo> {
  return request<Todo>(`/todos/${id}`, { method: 'PATCH', body: payload })
}

export function deleteTodo(id: number): Promise<void> {
  return request<void>(`/todos/${id}`, { method: 'DELETE' })
}
