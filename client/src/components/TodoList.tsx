import type { Todo } from '../types'
import { TodoItem } from './TodoItem'

type Props = {
  todos: Todo[]
  onToggle: (todo: Todo) => void
  onDelete: (id: number) => void
}

export function TodoList({ todos, onToggle, onDelete }: Props) {
  if (todos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden>
          <svg viewBox="0 0 48 48" fill="none">
            <rect x="8" y="10" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
            <path d="M16 20h16M16 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h3>Hali vazifa yo‘q</h3>
        <p>Yuqoridagi maydonga birinchi vazifangizni yozing.</p>
      </div>
    )
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </ul>
  )
}
