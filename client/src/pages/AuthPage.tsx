import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'telegram' | 'register'

export function AuthPage() {
  const { login, register, requestTelegramCode, loginWithTelegram } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setInfo('')
    setCode('')
    setCodeSent(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
      } else if (mode === 'register') {
        await register(name.trim(), email.trim(), password)
      } else if (!codeSent) {
        const message = await requestTelegramCode(email.trim())
        setInfo(message)
        setCodeSent(true)
      } else {
        await loginWithTelegram(email.trim(), code.trim())
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      const message = await requestTelegramCode(email.trim())
      setInfo(message)
      setCodeSent(true)
      setCode('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-glow" aria-hidden />
      <div className="auth-panel">
        <header className="auth-brand">
          <span className="logo-mark" aria-hidden>
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
          <h1>Focus</h1>
          <p>Vazifalaringizni tartibga soling — faqat siz uchun.</p>
        </header>

        <div className="auth-tabs auth-tabs-3" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Kirish
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'telegram'}
            className={mode === 'telegram' ? 'active' : ''}
            onClick={() => switchMode('telegram')}
          >
            Bot
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => switchMode('register')}
          >
            Ro‘yxat
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <label>
              <span>Ism</span>
              <input
                type="text"
                autoComplete="name"
                required
                minLength={1}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ismingiz"
              />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (mode === 'telegram') {
                  setCodeSent(false)
                  setCode('')
                  setInfo('')
                }
              }}
              placeholder="siz@email.com"
            />
          </label>

          {mode === 'login' || mode === 'register' ? (
            <label>
              <span>Parol</span>
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kamida 6 belgi"
              />
            </label>
          ) : null}

          {mode === 'telegram' && codeSent ? (
            <label>
              <span>Telegram kodi</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={4}
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="6 xonali kod"
              />
            </label>
          ) : null}

          {mode === 'telegram' && !codeSent ? (
            <p className="auth-hint">Emailingizni kiriting — kod Telegram botiga yuboriladi.</p>
          ) : null}

          {info ? <p className="form-info">{info}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting
              ? 'Kutilmoqda…'
              : mode === 'register'
                ? 'Hisob ochish'
                : mode === 'telegram'
                  ? codeSent
                    ? 'Kod bilan kirish'
                    : 'Kod yuborish'
                  : 'Kirish'}
          </button>

          {mode === 'telegram' && codeSent ? (
            <button
              type="button"
              className="btn-ghost auth-resend"
              onClick={() => void handleResend()}
              disabled={submitting}
            >
              Kodni qayta yuborish
            </button>
          ) : null}
        </form>
      </div>
    </div>
  )
}
