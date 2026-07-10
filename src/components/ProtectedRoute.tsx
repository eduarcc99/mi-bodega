import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function AdminRoute() {
  const { isAdmin, loading } = useAuth()

  if (loading) return null
  if (!isAdmin) return <Navigate to="/pos" replace />
  return <Outlet />
}

export function CajeroRedirect() {
  const { isCajero, loading } = useAuth()

  if (loading) return null
  if (isCajero) return <Navigate to="/pos" replace />
  return <Navigate to="/dashboard" replace />
}
