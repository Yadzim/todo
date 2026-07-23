import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import * as todosApi from '../api/todos'
import { TodoForm } from '../components/TodoForm'
import { TodoList } from '../components/TodoList'
import { useAuth } from '../context/AuthContext'
import type { Todo } from '../types'

type Filter = 'all' | 'active' | 'done'

export function TodosPage() {
  const { user, logout } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    try {
      const data = await todosApi.fetchTodos()
      setTodos(data)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Yuklashda xatolik')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (filter === 'active') return todos.filter((t) => !t.completed)
    if (filter === 'done') return todos.filter((t) => t.completed)
    return todos
  }, [todos, filter])

  const stats = useMemo(() => {
    const done = todos.filter((t) => t.completed).length
    return { total: todos.length, done, left: todos.length - done }
  }, [todos])

  async function handleCreate(title: string, description: string) {
    const created = await todosApi.createTodo({
      title,
      description: description || undefined,
    })
    setTodos((prev) => [created, ...prev])
  }

  async function handleToggle(todo: Todo) {
    const updated = await todosApi.updateTodo(todo.id, { completed: !todo.completed })
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  async function handleDelete(id: number) {
    await todosApi.deleteTodo(id)
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="app-shell">
      <div className="bg-mesh" aria-hidden />

      <header className="topbar">
        <div className="brand">
          <span className="logo-mark sm" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5l4.5 4.5L19 7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="brand-name">Focus</span>
        </div>

        <nav className="main-nav">
          <Link to="/" className="active">
            Vazifalar
          </Link>
          <Link to="/reminders">Eslatmalar</Link>
        </nav>

        <div className="user-chip">
          <span className="user-email" title={user?.email}>
            {user?.name || user?.email}
          </span>
          <button type="button" className="btn-ghost" onClick={logout}>
            Chiqish
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="hero-block">
          <h1>Bugungi reja</h1>
          <p>
            {stats.left === 0 && stats.total > 0
              ? 'Hammasi bajarildi — ajoyib!'
              : `${stats.left} ta ochiq vazifa · ${stats.done} ta yakunlangan`}
          </p>
        </section>

        <TodoForm onSubmit={handleCreate} />

        <div className="filter-row" role="tablist">
          {(
            [
              ['all', 'Hammasi'],
              ['active', 'Faol'],
              ['done', 'Bajarilgan'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? 'active' : ''}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {loading ? (
          <div className="loading-state">Yuklanmoqda…</div>
        ) : (
          <TodoList todos={filtered} onToggle={handleToggle} onDelete={handleDelete} />
        )}
      </main>
    </div>
  )
}
