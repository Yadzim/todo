import type { Todo } from '../types'

type Props = {
  todo: Todo
  onToggle: (todo: Todo) => void
  onDelete: (id: number) => void
}

export function TodoItem({ todo, onToggle, onDelete }: Props) {
  return (
    <li className={`todo-item ${todo.completed ? 'is-done' : ''}`}>
      <button
        type="button"
        className="todo-check"
        aria-label={todo.completed ? 'Bajarilmagan deb belgilash' : 'Bajarildi deb belgilash'}
        onClick={() => onToggle(todo)}
      >
        <span className="check-ring">
          {todo.completed ? (
            <svg viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M4.5 10.5l3.5 3.5 7.5-8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
      </button>

      <div className="todo-body">
        <p className="todo-title">{todo.title}</p>
        {todo.description ? <p className="todo-desc">{todo.description}</p> : null}
      </div>

      <button
        type="button"
        className="todo-delete"
        aria-label="O‘chirish"
        onClick={() => onDelete(todo.id)}
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
  )
}
