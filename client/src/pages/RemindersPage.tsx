import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import * as remindersApi from '../api/reminders'
import { useAuth } from '../context/AuthContext'
import type { Reminder, TelegramStatus } from '../types'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function RemindersPage() {
  const { user, logout } = useAuth()
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [remindAt, setRemindAt] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 30)
    return toLocalInputValue(d)
  })
  const [busy, setBusy] = useState(false)
  const [linking, setLinking] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [tg, list] = await Promise.all([
        remindersApi.getTelegramStatus(),
        remindersApi.fetchReminders(),
      ])
      setStatus(tg)
      setReminders(list)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Yuklashda xatolik')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, 8000)
    return () => window.clearInterval(id)
  }, [refresh])

  async function handleConnect() {
    setLinking(true)
    setError('')
    try {
      const tg = await remindersApi.createTelegramLink()
      setStatus(tg)
      if (tg.deep_link) {
        window.open(tg.deep_link, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ulanishda xatolik')
    } finally {
      setLinking(false)
    }
  }

  async function handleUnlink() {
    setBusy(true)
    try {
      const tg = await remindersApi.unlinkTelegram()
      setStatus(tg)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Uzishda xatolik')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const created = await remindersApi.createReminder({
        title: title.trim(),
        note: note.trim() || undefined,
        remind_at: new Date(remindAt).toISOString(),
      })
      setReminders((prev) => [...prev, created].sort((a, b) => a.remind_at.localeCompare(b.remind_at)))
      setTitle('')
      setNote('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Qo‘shishda xatolik')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: number) {
    await remindersApi.deleteReminder(id)
    setReminders((prev) => prev.filter((item) => item.id !== id))
  }

  const connected = Boolean(status?.connected)

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
          <Link to="/">Vazifalar</Link>
          <Link to="/reminders" className="active">
            Eslatmalar
          </Link>
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
          <h1>Eslatmali notelar</h1>
          <p>Vaqti kelganda eslatma Telegram botiga yuboriladi.</p>
        </section>

        <section className="telegram-card">
          <div>
            <h2>Telegram</h2>
            {!status?.bot_configured ? (
              <p>Bot hali sozlanmagan. Serverda TELEGRAM_BOT_TOKEN va TELEGRAM_BOT_USERNAME kerak.</p>
            ) : connected ? (
              <p className="ok-text">Ulangan — eslatmalar botga yuboriladi.</p>
            ) : (
              <p>Eslatma qo‘shish uchun avval botga ulaning.</p>
            )}
          </div>

          <div className="telegram-actions">
            {connected ? (
              <button type="button" className="btn-ghost" onClick={handleUnlink} disabled={busy}>
                Uzish
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleConnect}
                disabled={linking || !status?.bot_configured}
              >
                {linking ? 'Havola…' : 'Telegramga ulash'}
              </button>
            )}
            {!connected && status?.deep_link ? (
              <a className="deep-link" href={status.deep_link} target="_blank" rel="noreferrer">
                Havolani ochish
              </a>
            ) : null}
          </div>
        </section>

        {connected ? (
          <form className="todo-composer reminder-composer" onSubmit={handleCreate}>
            <div className="composer-fields">
              <input
                className="composer-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Eslatma sarlavhasi…"
                maxLength={255}
                required
              />
              <input
                className="composer-desc"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Izoh (ixtiyoriy)"
                maxLength={2000}
              />
              <label className="datetime-field">
                <span>Eslatma vaqti</span>
                <input
                  type="datetime-local"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                  required
                />
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={busy || !title.trim()}>
              Qo‘shish
            </button>
          </form>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        {loading ? (
          <div className="loading-state">Yuklanmoqda…</div>
        ) : reminders.length === 0 ? (
          <div className="empty-state">
            <h3>Eslatma yo‘q</h3>
            <p>
              {connected
                ? 'Birinchi eslatmangizni yuqoridan qo‘shing.'
                : 'Avval Telegramga ulaning, keyin eslatma qo‘shing.'}
            </p>
          </div>
        ) : (
          <ul className="todo-list">
            {reminders.map((item) => (
              <li key={item.id} className={`todo-item ${item.is_sent ? 'is-done' : ''}`}>
                <div className="reminder-badge" aria-hidden>
                  {item.is_sent ? '✓' : '⏰'}
                </div>
                <div className="todo-body">
                  <p className="todo-title">{item.title}</p>
                  {item.note ? <p className="todo-desc">{item.note}</p> : null}
                  <p className="todo-desc">{formatDateTime(item.remind_at)}</p>
                </div>
                <button
                  type="button"
                  className="todo-delete"
                  aria-label="O‘chirish"
                  onClick={() => void handleDelete(item.id)}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path
                      d="M5 6h10M8 6V4.5h4V6m-5.5 0v9.5h7V6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
