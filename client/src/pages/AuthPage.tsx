import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { OTP_LENGTH, OtpInput } from '../components/OtpInput'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'telegram' | 'register'
type BotMethod = 'email' | 'pair'

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function AuthPage() {
  const {
    login,
    register,
    requestTelegramCode,
    loginWithTelegram,
    createTelegramPair,
    pollTelegramPair,
  } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [botMethod, setBotMethod] = useState<BotMethod>('pair')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [pairCode, setPairCode] = useState('')
  const [pairSessionId, setPairSessionId] = useState<string | null>(null)
  const [botLink, setBotLink] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [remainingSec, setRemainingSec] = useState(0)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const waitingPair = mode === 'telegram' && botMethod === 'pair' && Boolean(pairSessionId)

  useEffect(() => {
    if (!expiresAt || !(codeSent || waitingPair)) {
      setRemainingSec(0)
      return
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setRemainingSec(left)
    }

    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [expiresAt, codeSent, waitingPair])

  useEffect(() => {
    if (!pairSessionId || !waitingPair || remainingSec <= 0) return

    let cancelled = false
    const poll = async () => {
      try {
        const status = await pollTelegramPair(pairSessionId)
        if (cancelled) return
        if (status === 'expired') {
          setError('Kod muddati tugagan. Yangi kod oling.')
          setInfo('')
        }
      } catch {
        // polling davom etadi
      }
    }

    void poll()
    const id = window.setInterval(() => void poll(), 2000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pairSessionId, waitingPair, remainingSec, pollTelegramPair])

  function resetTelegramState() {
    setCode('')
    setCodeSent(false)
    setPairCode('')
    setPairSessionId(null)
    setBotLink(null)
    setExpiresAt(null)
    setInfo('')
    setError('')
  }

  function switchMode(next: Mode) {
    setMode(next)
    resetTelegramState()
  }

  async function sendEmailCode() {
    const result = await requestTelegramCode(email.trim())
    setInfo(result.message)
    setExpiresAt(result.expires_at)
    setCodeSent(true)
    setCode('')
  }

  async function startPairLogin() {
    const result = await createTelegramPair()
    setPairSessionId(result.session_id)
    setPairCode(result.code)
    setExpiresAt(result.expires_at)
    setBotLink(result.bot_link)
    setInfo('Kodni Telegram botiga yuboring — tasdiqlangach avtomatik kirasiz.')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!(mode === 'telegram' && botMethod === 'pair' && pairSessionId)) {
      setInfo('')
    }
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
      } else if (mode === 'register') {
        await register(name.trim(), email.trim(), password)
      } else if (botMethod === 'pair') {
        if (!pairSessionId) {
          await startPairLogin()
        }
      } else if (!codeSent) {
        await sendEmailCode()
      } else {
        if (remainingSec <= 0) {
          setError('Kod muddati tugagan. Qayta yuboring.')
          return
        }
        if (code.length !== OTP_LENGTH) {
          setError('6 xonali kodni to‘liq kiriting')
          return
        }
        await loginWithTelegram(email.trim(), code)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResendEmail() {
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      await sendEmailCode()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleNewPairCode() {
    setError('')
    setSubmitting(true)
    try {
      await startPairLogin()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi')
    } finally {
      setSubmitting(false)
    }
  }

  const expired = (codeSent || waitingPair) && remainingSec <= 0

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
          {mode === 'telegram' ? (
            <div className="bot-methods" role="tablist">
              <button
                type="button"
                role="tab"
                className={botMethod === 'pair' ? 'active' : ''}
                onClick={() => {
                  setBotMethod('pair')
                  resetTelegramState()
                }}
              >
                Kodni botga
              </button>
              <button
                type="button"
                role="tab"
                className={botMethod === 'email' ? 'active' : ''}
                onClick={() => {
                  setBotMethod('email')
                  resetTelegramState()
                }}
              >
                Email orqali
              </button>
            </div>
          ) : null}

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

          {mode === 'login' || mode === 'register' || (mode === 'telegram' && botMethod === 'email') ? (
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
                    setExpiresAt(null)
                  }
                }}
                placeholder="siz@email.com"
              />
            </label>
          ) : null}

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

          {mode === 'telegram' && botMethod === 'email' && codeSent ? (
            <div className="otp-block">
              <div className="otp-header">
                <span>Telegram kodi</span>
                <span className={`otp-timer ${expired ? 'is-expired' : ''}`}>
                  {expired ? 'Muddati tugadi' : formatCountdown(remainingSec)}
                </span>
              </div>
              <OtpInput value={code} onChange={setCode} disabled={submitting || expired} />
            </div>
          ) : null}

          {mode === 'telegram' && botMethod === 'pair' && pairSessionId ? (
            <div className="pair-block">
              <div className="otp-header">
                <span>Botga yuboring</span>
                <span className={`otp-timer ${expired ? 'is-expired' : ''}`}>
                  {expired ? 'Muddati tugadi' : formatCountdown(remainingSec)}
                </span>
              </div>
              <div className="pair-code" aria-live="polite">
                {pairCode}
              </div>
              <p className="auth-hint">
                Telegram botga shu kodni yuboring. Hisobingiz botga ulangan bo‘lishi kerak.
              </p>
              {botLink ? (
                <a className="deep-link" href={botLink} target="_blank" rel="noreferrer">
                  Botni ochish
                </a>
              ) : null}
              {!expired ? <p className="pair-waiting">Tasdiq kutilmoqda…</p> : null}
            </div>
          ) : null}

          {mode === 'telegram' && botMethod === 'email' && !codeSent ? (
            <p className="auth-hint">Emailingizni kiriting — kod Telegram botiga yuboriladi.</p>
          ) : null}

          {mode === 'telegram' && botMethod === 'pair' && !pairSessionId ? (
            <p className="auth-hint">
              Sayt kod yaratadi. Uni botga yuborsangiz, ulangan hisobingiz bilan kirasiz (2 daqiqa).
            </p>
          ) : null}

          {info ? <p className="form-info">{info}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          {!(mode === 'telegram' && botMethod === 'pair' && pairSessionId) ? (
            <button
              type="submit"
              className="btn-primary"
              disabled={
                submitting ||
                (mode === 'telegram' &&
                  botMethod === 'email' &&
                  codeSent &&
                  (expired || code.length !== OTP_LENGTH))
              }
            >
              {submitting
                ? 'Kutilmoqda…'
                : mode === 'register'
                  ? 'Hisob ochish'
                  : mode === 'telegram'
                    ? botMethod === 'pair'
                      ? 'Kod yaratish'
                      : codeSent
                        ? 'Kod bilan kirish'
                        : 'Kod yuborish'
                    : 'Kirish'}
            </button>
          ) : null}

          {mode === 'telegram' && botMethod === 'pair' && pairSessionId && expired ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleNewPairCode()}
              disabled={submitting}
            >
              Yangi kod
            </button>
          ) : null}

          {mode === 'telegram' && botMethod === 'email' && codeSent ? (
            <button
              type="button"
              className="btn-ghost auth-resend"
              onClick={() => void handleResendEmail()}
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
