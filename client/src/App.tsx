import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { TodosPage } from './pages/TodosPage'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-spinner" aria-hidden />
        <p>Focus</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-spinner" aria-hidden />
        <p>Focus</p>
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <AuthPage />
          </PublicOnly>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <TodosPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
