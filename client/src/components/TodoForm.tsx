import { useState, type FormEvent } from 'react'

type Props = {
  onSubmit: (title: string, description: string) => Promise<void>
}

export function TodoForm({ onSubmit }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || busy) return

    setBusy(true)
    try {
      await onSubmit(trimmed, description.trim())
      setTitle('')
      setDescription('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="todo-composer" onSubmit={handleSubmit}>
      <div className="composer-fields">
        <input
          className="composer-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Yangi vazifa…"
          maxLength={255}
          required
        />
        <input
          className="composer-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Izoh (ixtiyoriy)"
          maxLength={2000}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={busy || !title.trim()}>
        Qo‘shish
      </button>
    </form>
  )
}
